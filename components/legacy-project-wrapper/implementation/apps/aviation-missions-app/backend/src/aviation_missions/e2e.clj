(ns aviation-missions.e2e
  "Clojure adapter for the Aviation SDK signed run and isolated store contract."
  (:import [java.io File]
           [java.nio.charset StandardCharsets]
           [java.security MessageDigest]
           [javax.crypto Mac]
           [javax.crypto.spec SecretKeySpec]))

(def run-id (System/getenv "AVIATION_E2E_RUN_ID"))
(def ^:private secret (System/getenv "AVIATION_E2E_SECRET"))
(def ^:private configured-dir (System/getenv "AVIATION_E2E_DATA_DIR"))
(def ^:private max-age-ms (* 15 60 1000))

(defn enabled? [] (some? run-id))

(defn- validated-dir []
  (when-not (and (re-matches #"e2e_[0-9a-f]{32}" run-id)
                 secret (<= 32 (count secret)) configured-dir)
    (throw (ex-info "Missions E2E requires a valid run ID and secret" {})))
  (let [expected (.getCanonicalPath (File. (str "/tmp/aviation-e2e/" run-id)))
        supplied (.getCanonicalPath (File. configured-dir))]
    (when-not (= expected supplied)
      (throw (ex-info "Missions E2E database path is not isolated" {})))
    (.mkdirs (File. expected))
    expected))

(def test-data-dir
  (if (enabled?) (validated-dir)
      (do (when configured-dir
            (throw (ex-info "Partial Missions E2E configuration" {})))
          nil)))

(defn- current-time-ms [] (System/currentTimeMillis))

(defn- valid-headers? [headers]
  (try
    (let [supplied-run (get headers "x-aviation-test-run")
          expiry-text (get headers "x-aviation-test-expires")
          supplied-signature (get headers "x-aviation-test-signature")
          now (current-time-ms)]
      (when (and (= run-id supplied-run)
                 (re-matches #"[0-9]{13}" (or expiry-text ""))
                 (re-matches #"[0-9a-f]{64}" (or supplied-signature "")))
        (let [expiry (Long/parseLong expiry-text)
              mac (Mac/getInstance "HmacSHA256")
              key (SecretKeySpec. (.getBytes secret StandardCharsets/UTF_8) "HmacSHA256")]
          (.init mac key)
          (let [message (str "aviation-missions-app\n" run-id "\n" expiry-text)
                expected (.doFinal mac (.getBytes message StandardCharsets/UTF_8))
                supplied (.parseHex (java.util.HexFormat/of) supplied-signature)]
            (and (< now expiry) (<= expiry (+ now max-age-ms))
                 (MessageDigest/isEqual expected supplied))))))
    (catch Exception _ false)))

(defn wrap-test-traffic [handler]
  (fn [request]
    (let [headers (:headers request)
          has-test-header (some #(contains? headers %)
                                ["x-aviation-test-run" "x-aviation-test-expires"
                                 "x-aviation-test-signature"])
          allowed (if (enabled?) (valid-headers? headers) (not has-test-header))]
      (if allowed
        (handler request)
        {:status 403
         :headers {"Content-Type" "application/json"}
         :body "{\"error\":\"E2E credential rejected\"}"}))))
