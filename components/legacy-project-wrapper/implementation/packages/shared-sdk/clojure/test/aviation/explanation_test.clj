(ns aviation.explanation-test
  (:require [clojure.test :refer :all]
            [clojure.string :as str]
            [aviation.explanation :as explanation])
  (:import [com.sun.net.httpserver HttpServer HttpHandler]
           [java.net InetSocketAddress]
           [java.nio.charset StandardCharsets]
           [java.io BufferedReader InputStreamReader]
           [java.util.concurrent Executors CountDownLatch TimeUnit]
           [javax.crypto Mac]
           [javax.crypto.spec SecretKeySpec]
           [java.math BigInteger]))

(def app-id "aviation-missions-app")
(def run-id (str "e2e_" (apply str (repeat 32 "a"))))
(def secret "synthetic-clojure-sdk-signing-secret-32-characters")
(def ^:dynamic *actor* nil)

(defn- text [response]
  (let [body (:body response)] (if (bytes? body) (String. ^bytes body StandardCharsets/UTF_8) body)))

(defn- credentials []
  (let [expires (+ (System/currentTimeMillis) 300000)
        mac (doto (Mac/getInstance "HmacSHA256")
              (.init (SecretKeySpec. (.getBytes secret StandardCharsets/UTF_8) "HmacSHA256")))
        signature (.doFinal mac (.getBytes (str app-id "\n" run-id "\n" expires) StandardCharsets/UTF_8))]
    {"x-aviation-test-run" run-id "x-aviation-test-expires" (str expires)
     "x-aviation-test-signature" (format "%064x" (BigInteger. 1 signature))}))

(defn- private-env [url]
  {"AVIATION_E2E_RUN_ID" run-id "AVIATION_E2E_SECRET" secret "AVIATION_EXPLAIN_BROKER_URL" url})

(defn- with-actor [tests]
  (let [entry (System/getenv "AVIATION_EXPLANATION_NODE_ENTRY")
        _ (when-not (and entry (.isFile (java.io.File. entry)))
            (throw (IllegalStateException. "Build the SDK broker and set AVIATION_EXPLANATION_NODE_ENTRY")))
        builder (ProcessBuilder. ^java.util.List [(or (System/getenv "AVIATION_EXPLANATION_NODE") "node")
                                                 entry "--app" app-id])
        environment (.environment builder)
        _ (.clear environment)
        _ (.putAll environment {"PATH" "/usr/local/bin:/usr/bin:/bin" "NODE_ENV" "test"
                                "AVIATION_E2E_RUN_ID" run-id "AVIATION_E2E_SECRET" secret})
        _ (.redirectError builder java.lang.ProcessBuilder$Redirect/INHERIT)
        process (.start builder)]
    (try
      (let [reader (BufferedReader. (InputStreamReader. (.getInputStream process) StandardCharsets/UTF_8))
            readiness (future (.readLine reader))
            line (deref readiness 5000 nil)
            url (second (re-find #"\"url\":\"(http://127\.0\.0\.1:[0-9]+)\"" (or line "")))]
        (when-not url (throw (IllegalStateException. "SDK broker did not become ready")))
        (binding [*actor* url] (tests)))
      (finally
        (.destroy process)
        (when-not (.waitFor process 5 TimeUnit/SECONDS)
          (.destroyForcibly process) (.waitFor process 5 TimeUnit/SECONDS))))))

(use-fixtures :once with-actor)

(defn- with-server [handler test]
  (let [server (HttpServer/create (InetSocketAddress. "127.0.0.1" 0) 0)
        executor (Executors/newCachedThreadPool)]
    (.setExecutor server executor)
    (.createContext server "/" (reify HttpHandler (handle [_ exchange] (handler exchange))))
    (.start server)
    (try (test (str "http://127.0.0.1:" (.getPort (.getAddress server))))
         (finally (.stop server 0) (.shutdownNow executor)))))

(defn- reply [exchange status body & [identity]]
  (.set (.getResponseHeaders exchange) "X-Aviation-Application" (or identity app-id))
  (.set (.getResponseHeaders exchange) "Content-Type" "application/json")
  (let [payload (.getBytes body StandardCharsets/UTF_8)]
    (.sendResponseHeaders exchange status (alength payload))
    (with-open [output (.getResponseBody exchange)] (.write output payload))))

(deftest closed-destination-and-route-policy
  (doseq [url ["https://127.0.0.1:42" "http://example.test:42" "http://user:secret@127.0.0.1:42"
               "http://127.0.0.1:42/private" "http://127.0.0.1:42?secret=value"]]
    (is (= 503 (:status ((explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" url}})
                         {:uri "/api/explain/config" :request-method :get})))))
  (let [proxy (explanation/explanation-proxy app-id {:environment {}})
        wrapped (explanation/wrap-explanation (fn [_] {:status 200 :body "Application"}) app-id {:environment {}})]
    (is (nil? (proxy {:uri "/api/explain-other" :request-method :get})))
    (is (= "Application" (:body (wrapped {:uri "/health" :request-method :get}))))
    (is (= 404 (:status (proxy {:uri "/api/explain/requests/../../config" :request-method :get}))))
    (is (= 405 (:status (proxy {:uri "/api/explain" :request-method :get})))))
  (is (thrown? IllegalArgumentException
               (explanation/explanation-proxy app-id {:environment {"AVIATION_E2E_RUN_ID" ""}}))))

(deftest request-and-response-size-bounds
  (let [proxy (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" "http://127.0.0.1:1"}})]
    (is (= 413 (:status (proxy {:uri "/api/explain" :request-method :post :body (byte-array 524289)})))))
  (with-server #(reply % 200 (apply str (repeat 524289 "x")))
    (fn [url]
      (let [proxy (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" url}})]
        (is (= 503 (:status (proxy {:uri "/api/explain/config" :request-method :get}))))))))

(deftest identity-and-redirect-isolation
  (let [hits (atom [])]
    (with-server
      (fn [exchange]
        (swap! hits conj (str (.getRequestURI exchange)))
        (.set (.getResponseHeaders exchange) "Location" "/external")
        (reply exchange 302 "{}"))
      (fn [url]
        (let [proxy (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" url}})]
          (is (= 503 (:status (proxy {:uri "/api/explain/config" :request-method :get}))))
          (is (= ["/api/explain/config"] @hits))))))
  (with-server #(reply % 200 "{}" "another-app")
    (fn [url]
      (let [proxy (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" url}})]
        (is (= 503 (:status (proxy {:uri "/api/explain/config" :request-method :get}))))))))

(deftest body-read-has-a-hard-deadline
  (let [release (CountDownLatch. 1)]
    (with-server
      (fn [exchange]
        (try
          (.set (.getResponseHeaders exchange) "X-Aviation-Application" app-id)
          (.sendResponseHeaders exchange 200 0)
          (with-open [output (.getResponseBody exchange)]
            (.write output 120) (.flush output)
            (.await release 3 TimeUnit/SECONDS))
          (catch Exception _ nil)))
      (fn [url]
        (try
          (let [proxy (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" url} :timeout-ms 150})
                start (System/nanoTime)
                response (proxy {:uri "/api/explain/config" :request-method :get})]
            (is (= 503 (:status response)))
            (is (< (/ (- (System/nanoTime) start) 1e6) 2000)))
          (finally (.countDown release)))))))

(deftest actual-broker-queue-follow-up-and-zero-residuals
  (let [proxy (explanation/explanation-proxy app-id {:environment (private-env *actor*)})
        headers (assoc (credentials) "content-type" "application/json")
        call (fn [method path body & [extra]]
               (proxy {:request-method method :uri path :body body :headers (merge headers extra)}))]
    (is (= 403 (:status (proxy {:request-method :get :uri "/api/explain/config"}))))
    (is (= 200 (:status (call :post "/api/explain/__e2e/fixtures"
                             (str "{\"fixture_type\":\"explanation\",\"record\":{\"is_test_data\":true,\"test_run_id\":\""
                                  run-id "\",\"app_id\":\"" app-id "\"}}")))))
    (try
      (doseq [[history count] [["[]" 0] ["[{\"role\":\"user\",\"content\":\"Why?\"},{\"role\":\"assistant\",\"content\":\"Synthetic facts.\"}]" 2]]]
        (let [queued (call :post "/api/explain" (str "{\"context\":\"Synthetic mission decision\",\"question\":\"Which facts support it?\",\"history\":" history "}"))
              ticket (text queued)
              request-id (second (re-find #"\"requestId\":\"(exp_[0-9a-f]{32})\"" ticket))
              token (second (re-find #"\"accessToken\":\"([0-9a-f]{64})\"" ticket))
              path (str "/api/explain/requests/" request-id)]
          (is (= 202 (:status queued)))
          (is (and request-id token))
          (is (= 404 (:status (call :get path nil {"x-aviation-explain-token" (apply str (repeat 64 "0"))}))))
          (let [result (call :get path nil {"x-aviation-explain-token" token})]
            (is (= 200 (:status result)))
            (is (str/includes? (text result) "SDK fixture explanation."))
            (is (str/includes? (text result) (str "Follow-up history: " count " messages."))))
          (is (= 200 (:status (call :delete path nil {"x-aviation-explain-token" token}))))))
      (finally
        (let [cleaned (call :delete (str "/api/explain/__e2e/runs/" run-id) nil)]
          (is (= 200 (:status cleaned)))
          (is (str/includes? (text cleaned) "\"count\":0")))))
    (let [normal (explanation/explanation-proxy app-id {:environment {"AVIATION_EXPLAIN_BROKER_URL" *actor*}})]
      (is (= 503 (:status (normal {:uri "/api/explain/config" :request-method :get})))))))
