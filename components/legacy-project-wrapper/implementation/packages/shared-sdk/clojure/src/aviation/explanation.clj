(ns aviation.explanation
  "Thin Ring binding to the application-owned SDK explanation broker. No provider logic."
  (:require [clojure.string :as str])
  (:import [java.io ByteArrayOutputStream InputStream]
           [java.net URI Proxy ProxySelector]
           [java.net.http HttpClient HttpClient$Redirect HttpRequest HttpRequest$BodyPublishers
            HttpResponse$BodyHandler HttpResponse$BodySubscriber]
           [java.nio ByteBuffer]
           [java.nio.charset StandardCharsets]
           [java.time Duration]
           [java.util Collections]
           [java.util.concurrent CompletableFuture TimeUnit]))

(def ^:private max-body 524288)
(def ^:private forwarded #{"content-type" "x-aviation-explain-token" "x-aviation-test-run"
                          "x-aviation-test-expires" "x-aviation-test-signature"})

(defn- error-response [status]
  {:status status
   :headers {"Content-Type" "application/json" "Cache-Control" "no-store"}
   :body (str "{\"error\":\"" (case status
                                404 "Explanation request was not found."
                                405 "Invalid explanation method."
                                413 "Explanation request is too large."
                                403 "Explanation access was not authorized."
                                "AI explanations are unavailable.") "\"}")})

(defn- allowed-methods [path private?]
  (cond
    (= path "/api/explain") #{:post}
    (#{"/api/explain/config" "/api/explain/widget.js"} path) #{:get}
    (= path "/api/explain/callback") #{:post}
    (re-matches #"/api/explain/requests/exp_[0-9a-f]{32}" path) #{:get :delete}
    (and private? (= path "/api/explain/__e2e/fixtures")) #{:post}
    (and private? (= path "/api/explain/__e2e/status")) #{:get}
    (and private? (re-matches #"/api/explain/__e2e/runs/e2e_[0-9a-f]{32}" path)) #{:get :delete}
    :else #{}))

(defn- broker-uri [value]
  (try
    (let [uri (URI. (or value ""))]
      (when (and (= "http" (.getScheme uri))
                 (#{"127.0.0.1" "::1" "[::1]"} (.getHost uri))
                 (<= 1 (.getPort uri) 65535)
                 (nil? (.getUserInfo uri)) (nil? (.getQuery uri)) (nil? (.getFragment uri))
                 (#{"" "/"} (.getPath uri)))
        (str/replace (str uri) #"/$" "")))
    (catch Exception _ nil)))

(defn- read-body [body]
  (cond
    (nil? body) (byte-array 0)
    (instance? InputStream body) (.readNBytes ^InputStream body (inc max-body))
    (string? body) (.getBytes ^String body StandardCharsets/UTF_8)
    (bytes? body) body
    :else (throw (ex-info "Invalid request body" {}))))

(defn- selected-headers [headers]
  (reduce-kv (fn [result key value]
               (when-not (string? key) (throw (ex-info "Invalid request header" {})))
               (let [name (str/lower-case key)]
                 (if-not (forwarded name) result
                   (do
                     (when (or (contains? result name) (not (string? value)) (> (count value) 8192))
                       (throw (ex-info "Invalid request header" {})))
                     (assoc result name value)))))
             {} (or headers {})))

(defn- bounded-subscriber [subscription]
  (let [result (CompletableFuture.)
        output (ByteArrayOutputStream.)]
    (reify HttpResponse$BodySubscriber
      (getBody [_] result)
      (onSubscribe [_ incoming]
        (reset! subscription incoming)
        (.request incoming 1))
      (onNext [_ buffers]
        (try
          (doseq [^ByteBuffer buffer buffers]
            (let [size (.remaining buffer)]
              (when (> (+ (.size output) size) max-body)
                (throw (ex-info "Explanation response exceeds limit" {})))
              (let [chunk (byte-array size)]
                (.get buffer chunk)
                (.write output chunk 0 size))))
          (.request @subscription 1)
          (catch Exception error
            (.cancel @subscription)
            (.completeExceptionally result error))))
      (onError [_ error] (.completeExceptionally result error))
      (onComplete [_] (.complete result (.toByteArray output))))))

(defn explanation-proxy
  "Return a Ring handler for the SDK namespace, or nil for an application route.
   The broker authenticates signed test traffic and callback/result credentials."
  ([app-id] (explanation-proxy app-id {}))
  ([app-id {:keys [environment timeout-ms] :or {environment (System/getenv) timeout-ms 15000}}]
   (when-not (and (string? app-id) (re-matches #"[a-z][a-z0-9-]{0,63}" app-id)
                  (integer? timeout-ms) (<= 1 timeout-ms 15000))
     (throw (IllegalArgumentException. "Invalid explanation binding configuration")))
   (let [run (get environment "AVIATION_E2E_RUN_ID")
         secret (get environment "AVIATION_E2E_SECRET")
         _ (when (and (contains? environment "AVIATION_E2E_RUN_ID")
                      (not (and (string? run) (re-matches #"e2e_[0-9a-f]{32}" run)
                                (string? secret) (<= 32 (count secret)))))
             (throw (IllegalArgumentException. "Invalid isolated explanation configuration")))
         broker (broker-uri (get environment "AVIATION_EXPLAIN_BROKER_URL"))
         client (-> (HttpClient/newBuilder)
                    (.connectTimeout (Duration/ofMillis (min timeout-ms 2000)))
                    (.followRedirects HttpClient$Redirect/NEVER)
                    (.proxy (proxy [ProxySelector] []
                              (select [_uri] (Collections/singletonList Proxy/NO_PROXY))
                              (connectFailed [_uri _address _error] nil)))
                    (.build))]
     (fn [{:keys [uri request-method headers body]}]
       (when (and (string? uri) (or (= uri "/api/explain") (str/starts-with? uri "/api/explain/")))
         (let [allowed (allowed-methods uri (some? run))]
           (cond
             (empty? allowed) (error-response 404)
             (not (allowed request-method)) (error-response 405)
             (nil? broker) (error-response 503)
             :else
             (let [subscription (atom nil)
                   pending (atom nil)]
               (try
                 (let [payload (read-body body)]
                   (if (> (alength payload) max-body) (error-response 413)
                     (let [selected (selected-headers headers)
                           builder (-> (HttpRequest/newBuilder (URI. (str broker uri)))
                                       (.timeout (Duration/ofMillis timeout-ms))
                                       (.header "X-Aviation-Application" app-id))
                           _ (doseq [[key value] selected] (.header builder key value))
                           publisher (if (= request-method :post)
                                       (HttpRequest$BodyPublishers/ofByteArray payload)
                                       (HttpRequest$BodyPublishers/noBody))
                           request (-> builder (.method (str/upper-case (name request-method)) publisher) (.build))
                           handler (reify HttpResponse$BodyHandler
                                     (apply [_ info]
                                       (when-not (and (= app-id (.orElse (.firstValue (.headers info) "X-Aviation-Application") nil))
                                                      (= run (.orElse (.firstValue (.headers info) "X-Aviation-Test-Run") nil)))
                                         (throw (ex-info "Broker identity does not match" {})))
                                       (bounded-subscriber subscription)))
                           future (.sendAsync client request handler)
                           _ (reset! pending future)
                           response (.get future timeout-ms TimeUnit/MILLISECONDS)
                           status (.statusCode response)]
                       (if (or (< status 200) (<= 300 status 399)) (error-response 503)
                         {:status status :body (.body response)
                          :headers (cond-> {"Content-Type" (.orElse (.firstValue (.headers response) "Content-Type") "application/json")
                                            "Cache-Control" "no-store" "X-Content-Type-Options" "nosniff"
                                            "X-Aviation-Application" app-id}
                                     run (assoc "X-Aviation-Test-Run" run))}))))
                 (catch Exception _
                   (when-let [future @pending] (.cancel future true))
                   (when-let [incoming @subscription] (.cancel incoming))
                   (error-response 503)))))))))))

(defn wrap-explanation
  ([handler app-id] (wrap-explanation handler app-id {}))
  ([handler app-id options]
   (let [explain (explanation-proxy app-id options)]
     (fn [request] (or (explain request) (handler request))))))
