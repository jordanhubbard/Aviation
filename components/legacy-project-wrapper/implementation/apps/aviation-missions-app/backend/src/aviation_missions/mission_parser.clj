(ns aviation-missions.mission-parser
  (:require [clojure.string :as str]
            [aviation-missions.db :as db]))

(defn parse-difficulty
  "Extract difficulty rating from text like '(difficulty: 7/10)'"
  [text]
  (when-let [match (re-find #"difficulty:\s*(\d+)/10" text)]
    (Integer/parseInt (second match))))

(defn parse-mission-section
  "Parse a single mission section from lines"
  [lines]
  (let [title-line (first lines)
        [title difficulty-str] (if (str/includes? title-line "(difficulty:")
                                 (str/split title-line #"\s*\(difficulty:")
                                 [title-line nil])
        difficulty (if difficulty-str
                    (parse-difficulty (str "(difficulty:" difficulty-str))
                    5) ; default difficulty
        
        ; Extract mission components from subsequent lines
        objective-line (first (filter #(str/starts-with? % "Objective:") lines))
        mission-line (first (filter #(str/starts-with? % "Mission:") lines))
        why-line (first (filter #(str/starts-with? % "Why:") lines))
        notes-line (first (filter #(str/starts-with? % "Notes:") lines))
        route-line (first (filter #(str/starts-with? % "Route:") lines))
        suggested-route-line (first (filter #(str/starts-with? % "Suggested Route:") lines))
        
        objective (when objective-line (str/trim (subs objective-line 10)))
        mission-desc (when mission-line (str/trim (subs mission-line 8)))
        why-desc (when why-line (str/trim (subs why-line 4)))
        notes (when notes-line (str/trim (subs notes-line 6)))
        route (when route-line (str/trim (subs route-line 6)))
        suggested-route (when suggested-route-line (str/trim (subs suggested-route-line 16)))]
    
    (when (and title objective mission-desc why-desc)
      {:title (str/trim title)
       :difficulty (or difficulty 5)
       :objective objective
       :mission_description mission-desc
       :why_description why-desc
       :notes notes
       :route route
       :suggested_route suggested-route})))

(defn determine-category
  "Determine mission category based on title and content"
  [title]
  (let [title-lower (str/lower-case title)]
    (cond
      (or (str/includes? title-lower "class b")
          (str/includes? title-lower "class c")
          (str/includes? title-lower "bravo")
          (str/includes? title-lower "charlie")) "Airspace Operations"
      (or (str/includes? title-lower "mountain")
          (str/includes? title-lower "terrain")
          (str/includes? title-lower "island")
          (str/includes? title-lower "catalina")
          (str/includes? title-lower "sierra")
          (str/includes? title-lower "tahoe")) "Terrain & Environment"
      (or (str/includes? title-lower "marine layer")
          (str/includes? title-lower "weather")
          (str/includes? title-lower "fog")
          (str/includes? title-lower "summer")
          (str/includes? title-lower "desert")) "Weather & Atmospheric"
      (or (str/includes? title-lower "navigation")
          (str/includes? title-lower "cross-country")
          (str/includes? title-lower "diversion")
          (str/includes? title-lower "dead reckoning")) "Navigation & Diversions"
      (or (str/includes? title-lower "airport")
          (str/includes? title-lower "runway")
          (str/includes? title-lower "pattern")
          (str/includes? title-lower "taxi")) "Airport Operations"
      (or (str/includes? title-lower "endurance")
          (str/includes? title-lower "longer")
          (str/includes? title-lower "overnight")
          (str/includes? title-lower "bush")) "Endurance & Planning"
      (or (str/includes? title-lower "audacious")
          (str/includes? title-lower "adventure")
          (str/includes? title-lower "death valley")
          (str/includes? title-lower "extreme")) "Advanced Adventures"
      :else "General Training")))

(defn parse-missions-file
  "Parse the missions.txt file and return structured mission data"
  [file-path]
  (try
    (let [content (slurp file-path)
          lines (str/split-lines content)
          ; Group lines by mission sections (look for numbered sections or clear breaks)
          missions (atom [])
          current-mission-lines (atom [])]
      
      (doseq [line lines]
        (let [trimmed-line (str/trim line)]
          (cond
            ; Skip empty lines and section headers
            (or (empty? trimmed-line)
                (str/starts-with? trimmed-line "1.")
                (str/starts-with? trimmed-line "2.")
                (str/starts-with? trimmed-line "3.")
                (str/starts-with? trimmed-line "4.")
                (str/starts-with? trimmed-line "5.")
                (str/starts-with? trimmed-line "6.")
                (str/starts-with? trimmed-line "7.")
                (str/starts-with? trimmed-line "Mission Debrief Cards")
                (str/starts-with? trimmed-line "Short \"Mission Cards\"")
                (str/starts-with? trimmed-line "Notes for Instructor"))
            (when (seq @current-mission-lines)
              (when-let [mission (parse-mission-section @current-mission-lines)]
                (swap! missions conj (assoc mission :category (determine-category (:title mission)))))
              (reset! current-mission-lines []))
            
            ; Check if this starts a new mission (contains difficulty or looks like a title)
            (and (not (str/starts-with? trimmed-line "Objective:"))
                 (not (str/starts-with? trimmed-line "Mission:"))
                 (not (str/starts-with? trimmed-line "Why:"))
                 (not (str/starts-with? trimmed-line "Notes:"))
                 (not (str/starts-with? trimmed-line "Route:"))
                 (not (str/starts-with? trimmed-line "Suggested Route:"))
                 (not (str/starts-with? trimmed-line "Debrief:"))
                 (or (str/includes? trimmed-line "difficulty:")
                     (and (> (count trimmed-line) 10)
                          (not (str/starts-with? trimmed-line "Alternate:")))))
            (do
              ; Process previous mission if exists
              (when (seq @current-mission-lines)
                (when-let [mission (parse-mission-section @current-mission-lines)]
                  (swap! missions conj (assoc mission :category (determine-category (:title mission))))))
              ; Start new mission
              (reset! current-mission-lines [trimmed-line]))
            
            ; Add to current mission
            (seq @current-mission-lines)
            (swap! current-mission-lines conj trimmed-line))))
      
      ; Process final mission
      (when (seq @current-mission-lines)
        (when-let [mission (parse-mission-section @current-mission-lines)]
          (swap! missions conj (assoc mission :category (determine-category (:title mission))))))
      
      @missions)
    (catch Exception e
      (println "Error parsing missions file:" (.getMessage e))
      [])))

(defn seed-database-with-missions!
  "Parse missions file and seed database"
  [file-path]
  (println "Parsing missions from" file-path)
  (let [missions (parse-missions-file file-path)]
    (println "Found" (count missions) "missions to import")
    (doseq [mission missions]
      (try
        (db/create-mission! mission)
        (println "Created mission:" (:title mission))
        (catch Exception e
          (println "Error creating mission" (:title mission) ":" (.getMessage e)))))
    (println "Database seeding completed")))
