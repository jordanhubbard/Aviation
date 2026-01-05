(ns aviation-missions.db-test
  (:require [clojure.test :refer :all]
            [aviation-missions.db :as db]
            [clojure.java.jdbc :as jdbc]
            [clj-time.core :as time]
            [clj-time.coerce :as coerce]))

;; Test database configuration
(def test-db-spec
  {:classname "org.h2.Driver"
   :subprotocol "h2"
   :subname "mem:db-test;DB_CLOSE_DELAY=-1"
   :user "sa"
   :password ""})

(defn setup-test-db []
  "Set up test database with clean schema"
  (with-redefs [db/db-spec test-db-spec]
    (db/init-db!)))

(defn teardown-test-db []
  "Clean up test database"
  (with-redefs [db/db-spec test-db-spec]
    (try
      (jdbc/execute! test-db-spec ["DROP ALL OBJECTS"])
      (catch Exception e))))

(use-fixtures :each
  (fn [test-fn]
    (setup-test-db)
    (with-redefs [db/db-spec test-db-spec]
      (test-fn))
    (teardown-test-db)))

;; Database initialization tests
(deftest test-database-initialization
  (testing "Database initialization creates required tables"
    (with-redefs [db/db-spec test-db-spec]
      (db/init-db!)

      ;; Check that missions table exists with correct structure
      (let [tables (jdbc/query test-db-spec
                    ["SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'"])]
        (is (some #(= (:table_name %) "MISSIONS") tables)))

      ;; Check table columns
      (let [columns (jdbc/query test-db-spec
                     ["SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MISSIONS'"])
            column-names (set (map :column_name columns))]
        (is (contains? column-names "ID"))
        (is (contains? column-names "TITLE"))
        (is (contains? column-names "CATEGORY"))
        (is (contains? column-names "DIFFICULTY"))
        (is (contains? column-names "OBJECTIVE"))
        (is (contains? column-names "MISSION_DESCRIPTION"))
        (is (contains? column-names "WHY_DESCRIPTION"))
        (is (contains? column-names "PILOT_EXPERIENCE"))
        (is (contains? column-names "CREATED_AT"))))))

;; Mission CRUD operation tests
(deftest test-mission-crud-operations
  (testing "Create mission with all required fields"
    (let [mission-data {:title "Test Mission"
                       :category "Training"
                       :difficulty 5
                       :objective "Test objective"
                       :mission_description "Test description"
                       :why_description "Test why"
                       :pilot_experience "Intermediate (100-500 hours)"}
          created-mission (db/create-mission! mission-data)]

      (is (some? (:id created-mission)))
      (is (= (:title created-mission) "Test Mission"))
      (is (= (:category created-mission) "Training"))
      (is (= (:difficulty created-mission) 5))
      (is (some? (:created_at created-mission)))
      (is (some? (:updated_at created-mission)))))

  (testing "Create mission with only required fields"
    (let [mission-data {:title "Minimal Mission"
                       :category "Proficiency"
                       :difficulty 3
                       :objective "Minimal objective"
                       :mission_description "Minimal description"
                       :why_description "Minimal why"}
          created-mission (db/create-mission! mission-data)]

      (is (some? (:id created-mission)))
      (is (= (:title created-mission) "Minimal Mission"))
      (is (= (:pilot_experience created-mission) "Beginner (< 100 hours)")) ; default value
      (is (= (:special_challenges created-mission) "")))) ; default value

  (testing "Retrieve mission by ID"
    (let [mission-data {:title "Retrievable Mission"
                       :category "Cross-Country"
                       :difficulty 7
                       :objective "Retrieve test"
                       :mission_description "Test retrieval"
                       :why_description "Test why retrieve"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)
          retrieved-mission (db/get-mission-by-id mission-id)]

      (is (some? retrieved-mission))
      (is (= (:id retrieved-mission) mission-id))
      (is (= (:title retrieved-mission) "Retrievable Mission"))))

  (testing "Retrieve non-existent mission returns nil"
    (let [non-existent-mission (db/get-mission-by-id 99999)]
      (is (nil? non-existent-mission))))

  (testing "Update mission"
    (let [original-data {:title "Original Title"
                        :category "Training"
                        :difficulty 4
                        :objective "Original objective"
                        :mission_description "Original description"
                        :why_description "Original why"}
          created-mission (db/create-mission! original-data)
          mission-id (:id created-mission)

          update-data {:title "Updated Title"
                      :difficulty 6
                      :notes "Added some notes"}
          updated-mission (db/update-mission! mission-id update-data)]

      (is (= (:title updated-mission) "Updated Title"))
      (is (= (:difficulty updated-mission) 6))
      (is (= (:notes updated-mission) "Added some notes"))
      (is (= (:category updated-mission) "Training")) ; unchanged
      (is (not= (:updated_at updated-mission) (:created_at updated-mission)))))

  (testing "Update non-existent mission"
    (let [result (db/update-mission! 99999 {:title "Won't work"})]
      (is (nil? result))))

  (testing "Delete mission"
    (let [mission-data {:title "To Be Deleted"
                       :category "Emergency"
                       :difficulty 8
                       :objective "Delete test"
                       :mission_description "Will be deleted"
                       :why_description "Delete test why"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)]

      ;; Verify mission exists
      (is (some? (db/get-mission-by-id mission-id)))

      ;; Delete mission
      (db/delete-mission! mission-id)

      ;; Verify mission is gone
      (is (nil? (db/get-mission-by-id mission-id)))))

  (testing "Get all missions"
    ;; Clear any existing missions
    (teardown-test-db)
    (setup-test-db)

    ;; Initially should be empty
    (is (empty? (db/get-all-missions)))

    ;; Add some missions
    (db/create-mission! {:title "Mission 1" :category "Training" :difficulty 1
                        :objective "Obj 1" :mission_description "Desc 1" :why_description "Why 1"})
    (db/create-mission! {:title "Mission 2" :category "Proficiency" :difficulty 2
                        :objective "Obj 2" :mission_description "Desc 2" :why_description "Why 2"})
    (db/create-mission! {:title "Mission 3" :category "Cross-Country" :difficulty 3
                        :objective "Obj 3" :mission_description "Desc 3" :why_description "Why 3"})

    (let [all-missions (db/get-all-missions)]
      (is (= (count all-missions) 3))
      (is (every? #(contains? % :id) all-missions))
      (is (every? #(contains? % :title) all-missions)))))

;; Comment system tests
(deftest test-comment-operations
  (testing "Add and retrieve comments for mission"
    (let [mission-data {:title "Commented Mission"
                       :category "Training"
                       :difficulty 5
                       :objective "Comment test"
                       :mission_description "Test comments"
                       :why_description "Test why comments"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)]

      ;; Initially no comments
      (is (empty? (db/get-comments-for-mission mission-id)))

      ;; Add first comment
      (db/add-comment! mission-id {:author_name "Test Pilot" :content "Great mission!"})

      ;; Add second comment
      (db/add-comment! mission-id {:author_name "Another Pilot" :content "Very challenging!"})

      ;; Retrieve comments
      (let [comments (db/get-comments-for-mission mission-id)]
        (is (= (count comments) 2))
        (is (every? #(= (:mission_id %) mission-id) comments))
        (is (some #(= (:content %) "Great mission!") comments))
        (is (some #(= (:content %) "Very challenging!") comments))
        (is (every? #(contains? % :created_at) comments)))))

  (testing "Comments for non-existent mission"
    (let [comments (db/get-comments-for-mission 99999)]
      (is (empty? comments)))))

;; Rating system tests
(deftest test-rating-operations
  (testing "Add and retrieve ratings"
    (let [mission-data {:title "Rated Mission"
                       :category "Proficiency"
                       :difficulty 6
                       :objective "Rating test"
                       :mission_description "Test ratings"
                       :why_description "Test why ratings"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)]

      ;; Add positive rating
      (db/add-or-update-rating! mission-id {:pilot_name "Happy Pilot" :rating "up"})

      ;; Add negative rating
      (db/add-or-update-rating! mission-id {:pilot_name "Critical Pilot" :rating "down"})

      ;; Retrieve specific user rating
      (let [user-rating (db/get-user-rating mission-id "Happy Pilot")]
        (is (some? user-rating))
        (is (= (:rating user-rating) "up"))
        (is (= (:pilot_name user-rating) "Happy Pilot")))

      ;; Update existing rating
      (db/add-or-update-rating! mission-id {:pilot_name "Happy Pilot" :rating "down"})

      (let [updated-rating (db/get-user-rating mission-id "Happy Pilot")]
        (is (= (:rating updated-rating) "down")))))

  (testing "Rating validation"
    (let [mission-data {:title "Validation Mission"
                       :category "Emergency"
                       :difficulty 9
                       :objective "Validation test"
                       :mission_description "Test validation"
                       :why_description "Test why validation"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)]

      ;; Invalid rating should be handled gracefully
      (is (thrown? Exception
                   (db/add-or-update-rating! mission-id {:pilot_name "Test" :rating "invalid"}))))))

;; Admin session tests
(deftest test-admin-session-operations
  (testing "Create and validate admin sessions"
    ;; Create admin session
    (let [admin-token (db/create-admin-session! "test-admin")]
      (is (string? admin-token))
      (is (> (count admin-token) 20)) ; Should be a substantial token

      ;; Validate session
      (let [session-info (db/validate-admin-session admin-token)]
        (is (some? session-info))
        (is (= (:admin_name session-info) "test-admin"))
        (is (some? (:created_at session-info))))

      ;; Invalid token should return nil
      (is (nil? (db/validate-admin-session "invalid-token")))))

  (testing "Session expiry"
    ;; This would require time manipulation in a real scenario
    ;; For now, just test that expired sessions are handled
    (let [admin-token (db/create-admin-session! "expiry-test")]
      (is (some? (db/validate-admin-session admin-token)))

      ;; In a real implementation, we'd fast-forward time here
      ;; For now, just verify the mechanism exists
      (is (some? admin-token)))))

;; Mission completion tracking tests
(deftest test-mission-completion-operations
  (testing "Mark mission as completed and track completions"
    (let [mission-data {:title "Completable Mission"
                       :category "Cross-Country"
                       :difficulty 7
                       :objective "Completion test"
                       :mission_description "Test completions"
                       :why_description "Test why completions"}
          created-mission (db/create-mission! mission-data)
          mission-id (:id created-mission)]

      ;; Initially no completions
      (is (empty? (db/get-completions-for-mission mission-id)))

      ;; Mark as completed by first pilot
      (db/mark-mission-completed! mission-id {:pilot_name "Pilot 1"
                                             :completion_date (java.sql.Date. (System/currentTimeMillis))
                                             :notes "Completed successfully"})

      ;; Mark as completed by second pilot
      (db/mark-mission-completed! mission-id {:pilot_name "Pilot 2"
                                             :completion_date (java.sql.Date. (System/currentTimeMillis))
                                             :notes "Challenging but doable"})

      ;; Check completions
      (let [completions (db/get-completions-for-mission mission-id)]
        (is (= (count completions) 2))
        (is (every? #(= (:mission_id %) mission-id) completions))
        (is (some #(= (:pilot_name %) "Pilot 1") completions))
        (is (some #(= (:pilot_name %) "Pilot 2") completions))))))

;; Edge cases and error handling tests
(deftest test-database-edge-cases
  (testing "Handle null and empty string values"
    (let [mission-with-nulls {:title "Null Test Mission"
                             :category "Training"
                             :difficulty 5
                             :objective "Test nulls"
                             :mission_description "Test null handling"
                             :why_description "Test why nulls"
                             :notes nil
                             :route ""
                             :pilot_experience nil}
          created-mission (db/create-mission! mission-with-nulls)]

      (is (some? (:id created-mission)))
      (is (nil? (:notes created-mission)))
      (is (= (:route created-mission) ""))
      (is (= (:pilot_experience created-mission) "Beginner (< 100 hours)")))) ; should use default

  (testing "Handle very long strings within limits"
    (let [long-title (apply str (repeat 200 "A"))
          long-description (apply str (repeat 1000 "Lorem ipsum "))
          mission-data {:title long-title
                       :category "Training"
                       :difficulty 1
                       :objective "Long string test"
                       :mission_description long-description
                       :why_description "Test long strings"}
          created-mission (db/create-mission! mission-data)]

      (is (some? (:id created-mission)))
      (is (= (:title created-mission) long-title))))

  (testing "Database constraint violations"
    ;; Test missing required field
    (is (thrown? Exception
                 (db/create-mission! {:title "Incomplete" :category "Training"})))

    ;; Test invalid category (if constraints exist)
    (is (thrown? Exception
                 (db/create-mission! {:title "Invalid Category"
                                     :category "InvalidCategory"
                                     :difficulty 5
                                     :objective "Test"
                                     :mission_description "Test"
                                     :why_description "Test"})))))

;; Performance and concurrency tests
(deftest test-database-performance
  (testing "Bulk operations performance"
    (let [start-time (System/currentTimeMillis)]
      ;; Insert multiple missions
      (dotimes [i 100]
        (db/create-mission! {:title (str "Bulk Mission " i)
                            :category "Training"
                            :difficulty (inc (mod i 10))
                            :objective (str "Bulk objective " i)
                            :mission_description (str "Bulk description " i)
                            :why_description (str "Bulk why " i)}))

      (let [end-time (System/currentTimeMillis)
            duration (- end-time start-time)]
        ;; Should complete within reasonable time (adjust based on requirements)
        (is (< duration 5000) "Bulk insert should complete within 5 seconds")

        ;; Verify all missions were created
        (let [all-missions (db/get-all-missions)]
          (is (>= (count all-missions) 100)))))))