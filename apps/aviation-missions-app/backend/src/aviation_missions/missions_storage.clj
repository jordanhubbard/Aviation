(ns aviation-missions.missions-storage
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.tools.logging :as log]
            [cheshire.core :as json]
            [aviation-missions.db :as db]
            [aviation-missions.mission-parser :as parser]))

(def ^:private missions-json-default "/app/missions.json")
(def ^:private missions-txt-default "/app/missions.txt")

(defn- existing-path
  [paths]
  (some (fn [path]
          (when (and path (.exists (io/file path)))
            path))
        paths))

(defn missions-json-path
  []
  (or (System/getenv "MISSIONS_JSON_PATH")
      (if (.exists (io/file "/app"))
        missions-json-default
        "../missions.json")))

(defn missions-txt-path
  []
  (or (System/getenv "MISSIONS_TXT_PATH")
      (existing-path [missions-txt-default "../missions.txt" "missions.txt"])
      missions-txt-default))

(defn- sanitize-mission
  [mission]
  (-> mission
      (select-keys [:id
                    :title
                    :category
                    :difficulty
                    :objective
                    :mission_description
                    :why_description
                    :notes
                    :route
                    :suggested_route
                    :pilot_experience
                    :special_challenges
                    :created_at
                    :updated_at])
      (update :created_at #(when % (str %)))
      (update :updated_at #(when % (str %)))))

(defn write-missions-json!
  [missions path]
  (let [payload {:version "1.0"
                 :exported_at (str (java.time.Instant/now))
                 :total_missions (count missions)
                 :missions (mapv sanitize-mission missions)}
        content (json/generate-string payload {:pretty true})]
    (io/make-parents path)
    (spit path content)
    (log/info (format "✅ Wrote %d missions to %s" (count missions) path))
    path))

(defn load-missions-json
  [path]
  (when (.exists (io/file path))
    (let [raw (slurp path)
          trimmed (str/trim raw)]
      (when-not (str/blank? trimmed)
        (let [parsed (json/parse-string trimmed true)]
          (or (:missions parsed) []))))))

(defn ensure-missions-json!
  ([] (ensure-missions-json! nil))
  ([missions-from-db]
   (let [json-path (missions-json-path)
         missions (load-missions-json json-path)]
     (if (seq missions)
       (do
         (log/info (format "✅ missions.json already present with %d missions" (count missions)))
         json-path)
       (if (seq missions-from-db)
         (do
           (log/info (format "Generating missions.json from %d database missions" (count missions-from-db)))
           (write-missions-json! missions-from-db json-path))
         (let [txt-path (missions-txt-path)
               parsed (parser/parse-missions-file txt-path)]
           (log/info (format "Generating missions.json from %s" txt-path))
           (write-missions-json! parsed json-path)))))))

(defn seed-db-from-json!
  []
  (let [json-path (missions-json-path)
        missions (load-missions-json json-path)]
    (if (seq missions)
      (let [imported (db/import-missions! missions)]
        (log/info (format "✅ Imported %d missions from %s" imported json-path))
        imported)
      (do
        (log/warn (format "⚠️  missions.json missing or empty at %s" json-path))
        0))))

(defn persist-missions-json!
  []
  (let [missions (db/export-all-missions)
        json-path (missions-json-path)]
    (write-missions-json! missions json-path)))
