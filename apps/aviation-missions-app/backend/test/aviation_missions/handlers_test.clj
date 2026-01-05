(ns aviation-missions.handlers-test
  (:require [clojure.test :refer :all]
            [ring.mock.request :as mock]
            [cheshire.core :as json]
            [aviation-missions.handlers :as handlers]
            [aviation-missions.db :as db]))

;; Test database configuration
(def test-db-spec
  {:classname "org.h2.Driver"
   :subprotocol "h2"
   :subname "mem:handlers-test-db;DB_CLOSE_DELAY=-1"
   :user "sa"
   :password ""})

(defn setup-test-db []
  (with-redefs [db/db-spec test-db-spec]
    (db/init-db!)))

(defn teardown-test-db []
  (with-redefs [db/db-spec test-db-spec]
    (try
      (clojure.java.jdbc/execute! test-db-spec ["DROP ALL OBJECTS"])
      (catch Exception e))))

(use-fixtures :each 
  (fn [test-fn]
    (setup-test-db)
    (with-redefs [db/db-spec test-db-spec]
      (test-fn))
    (teardown-test-db)))

;; Helper functions
(defn mock-request [method uri & {:keys [body headers params]}]
  "Create a mock request with optional body and headers"
  (cond-> (mock/request method uri)
    body (assoc :body body)
    headers (assoc :headers headers)
    params (assoc :params params)))

(defn admin-token []
  (with-redefs [db/db-spec test-db-spec]
    (db/create-admin-session! "admin")))

;; Handler function tests
(deftest test-admin-required-middleware
  "Test admin authentication middleware"
  
  (testing "Admin required with valid token"
    (let [token (admin-token)
          dummy-handler (fn [request] {:status 200 :body "success"})
          protected-handler (handlers/admin-required dummy-handler)
          request (mock-request :get "/test" 
                               :headers {"Authorization" (str "Bearer " token)})
          response (protected-handler request)]
      (is (= 200 (:status response)))))
  
  (testing "Admin required without token"
    (let [dummy-handler (fn [request] {:status 200 :body "success"})
          protected-handler (handlers/admin-required dummy-handler)
          request (mock-request :get "/test")
          response (protected-handler request)]
      (is (= 401 (:status response)))))
  
  (testing "Admin required with invalid token"
    (let [dummy-handler (fn [request] {:status 200 :body "success"})
          protected-handler (handlers/admin-required dummy-handler)
          request (mock-request :get "/test" 
                               :headers {"Authorization" "Bearer invalid-token"})
          response (protected-handler request)]
      (is (= 401 (:status response))))))

(deftest test-mission-handlers
  "Test mission-related handler functions"
  
  (testing "get-missions handler"
    (let [request (mock-request :get "/missions")
          response (handlers/get-missions request)]
      (is (= 200 (:status response)))
      (is (contains? (:body response) :missions))))
  
  (testing "get-mission handler with valid ID"
    ; First create a mission
    (let [mission (db/create-mission! {:title "Test Mission"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (str (:id mission))
          response (handlers/get-mission mission-id)]
      (is (some? mission)) ; Ensure mission was created
      (is (some? (:id mission))) ; Ensure mission has an ID
      (is (= 200 (:status response)))
      (is (contains? (:body response) :mission))))
  
  (testing "get-mission handler with invalid ID"
    (let [response (handlers/get-mission "invalid")]
      (is (= 400 (:status response)))))
  
  (testing "get-mission handler with non-existent ID"
    (let [response (handlers/get-mission "99999")]
      (is (= 404 (:status response)))))
  
  (testing "create-mission handler as admin"
    (let [token (admin-token)
          mission-data {:title "Handler Test Mission"
                       :category "Training"
                       :difficulty 3
                       :objective "Test handler"
                       :mission_description "Testing handler"
                       :why_description "To test handler"}
          request (mock-request :post "/missions"
                               :body mission-data
                               :headers {"authorization" (str "Bearer " token)})
          response (handlers/create-mission request)]
      (is (= 201 (:status response)))
      (is (contains? (:body response) :mission))))
  
  (testing "create-mission handler as non-admin (submission)"
    (let [mission-data {:title "Submission Test"
                       :category "Training"
                       :difficulty 3
                       :objective "Test submission"
                       :mission_description "Testing submission"
                       :why_description "To test submission"}
          request (mock-request :post "/missions" :body mission-data)
          response (handlers/create-mission request)]
      (is (= 201 (:status response)))
      (is (= "Mission submitted for approval" (get-in response [:body :message])))))
  
  (testing "create-mission handler with missing fields"
    (let [mission-data {:title "Incomplete Mission"}
          request (mock-request :post "/missions" :body mission-data)
          response (handlers/create-mission request)]
      (is (= 400 (:status response)))))
  
  (testing "update-mission handler as admin"
    (let [mission (db/create-mission! {:title "Original Title"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          token (admin-token)
          update-data {:title "Updated Title"}
          request (mock-request :put "/missions/1"
                               :body update-data
                               :headers {"authorization" (str "Bearer " token)})
          mission-id (str (:id mission))
          response (handlers/update-mission mission-id request)]
      (is (some? mission))
      (is (some? (:id mission)))
      (is (= 200 (:status response)))
      (is (contains? (:body response) :mission))))
  
  (testing "delete-mission handler"
    (let [mission (db/create-mission! {:title "To Delete"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (str (:id mission))
          response (handlers/delete-mission mission-id)]
      (is (some? mission))
      (is (some? (:id mission)))
      (is (= 200 (:status response))))))

(deftest test-comment-handlers
  "Test comment-related handlers"
  
  (testing "add-comment handler"
    (let [mission (db/create-mission! {:title "Comment Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          comment-data {:author_name "Test User" :content "Great mission!"}
          request (mock-request :post "/missions/1/comments" :body comment-data)
          mission-id (str (:id mission))
          response (handlers/add-comment mission-id request)]
      (is (some? mission))
      (is (some? (:id mission)))
      (is (= 201 (:status response)))))
  
  (testing "get-comments handler"
    (let [mission (db/create-mission! {:title "Comment Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (:id mission)
          _ (db/add-comment! mission-id {:author_name "Test" :content "Comment"})
          response (handlers/get-comments (str mission-id))]
      (is (some? mission))
      (is (some? mission-id))
      (is (= 200 (:status response)))
      (is (contains? (:body response) :comments)))))

(deftest test-rating-handlers
  "Test rating-related handlers"
  
  (testing "add-rating handler with valid rating"
    (let [mission (db/create-mission! {:title "Rating Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          rating-data {:pilot_name "Test Pilot" :rating "up"}
          request (mock-request :post "/missions/1/rating" :body rating-data)
          mission-id (str (:id mission))
          response (handlers/add-rating mission-id request)]
      (is (some? mission))
      (is (some? (:id mission)))
      (is (= 201 (:status response)))))
  
  (testing "add-rating handler with invalid rating"
    (let [mission (db/create-mission! {:title "Rating Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          rating-data {:pilot_name "Test Pilot" :rating "invalid"}
          request (mock-request :post "/missions/1/rating" :body rating-data)
          mission-id (str (:id mission))
          response (handlers/add-rating mission-id request)]
      (is (some? mission))
      (is (some? (:id mission)))
      (is (= 400 (:status response)))))
  
  (testing "get-user-rating handler"
    (let [mission (db/create-mission! {:title "Rating Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (:id mission)
          _ (db/add-or-update-rating! mission-id {:pilot_name "Test Pilot" :rating "up"})
          response (handlers/get-user-rating (str mission-id) "Test Pilot")]
      (is (some? mission))
      (is (some? mission-id))
      (is (= 200 (:status response)))
      (is (= "up" (get-in response [:body :rating]))))))

(deftest test-admin-handlers
  "Test admin-related handlers"
  
  (testing "admin-login with valid credentials"
    (let [credentials {:admin_name "admin" :password "aviation123"}
          request (mock-request :post "/admin/login" :body credentials)
          response (handlers/admin-login request)]
      (is (= 200 (:status response)))
      (is (contains? (:body response) :token))))
  
  (testing "admin-login with invalid credentials"
    (let [credentials {:admin_name "wrong" :password "wrong"}
          request (mock-request :post "/admin/login" :body credentials)
          response (handlers/admin-login request)]
      (is (= 401 (:status response)))))
  
  (testing "check-admin-status with valid token"
    (let [token (admin-token)
          request (mock-request :get "/admin/status" 
                               :headers {"Authorization" (str "Bearer " token)})
          response (handlers/check-admin-status request)]
      (is (= 200 (:status response)))
      (is (true? (get-in response [:body :is_admin])))))
  
  (testing "check-admin-status without token"
    (let [request (mock-request :get "/admin/status")
          response (handlers/check-admin-status request)]
      (is (= 200 (:status response)))
      (is (false? (get-in response [:body :is_admin]))))))

(deftest test-submission-handlers
  "Test submission-related handlers"
  
  (testing "create-submission handler"
    (let [submission-data {:title "Test Submission"
                          :category "Training"
                          :difficulty 3
                          :objective "Test"
                          :mission_description "Test"
                          :why_description "Test"
                          :submitter_name "Test User"}
          request (mock-request :post "/submissions" :body submission-data)
          response (handlers/create-submission request)]
      (is (= 201 (:status response)))))
  
  (testing "get-submissions handler"
    (let [_ (db/create-submission! {:title "Test"
                                   :category "Training"
                                   :difficulty 3
                                   :objective "Test"
                                   :mission_description "Test"
                                   :why_description "Test"
                                   :submitter_name "Test"})
          request (mock-request :get "/submissions")
          response (handlers/get-submissions request)]
      (is (= 200 (:status response)))
      (is (contains? (:body response) :submissions))))
  
  (testing "approve-submission handler"
    (let [submission-id (db/create-submission! {:title "To Approve"
                                               :category "Training"
                                               :difficulty 3
                                               :objective "Test"
                                               :mission_description "Test"
                                               :why_description "Test"
                                               :submitter_name "Test"})
          response (handlers/approve-submission (str submission-id))]
      (is (some? submission-id))
      (is (= 200 (:status response)))))
  
  (testing "reject-submission handler"
    (let [submission-id (db/create-submission! {:title "To Reject"
                                               :category "Training"
                                               :difficulty 3
                                               :objective "Test"
                                               :mission_description "Test"
                                               :why_description "Test"
                                               :submitter_name "Test"})
          response (handlers/reject-submission (str submission-id))]
      (is (some? submission-id))
      (is (= 200 (:status response))))))

(deftest test-import-export-handlers
  "Test import/export handlers"
  
  (testing "export-missions handler"
    (let [_ (db/create-mission! {:title "Export Test"
                                :category "Training"
                                :difficulty 5
                                :objective "Test"
                                :mission_description "Test"
                                :why_description "Test"})
          request (mock-request :get "/missions/export")
          response (handlers/export-missions request)]
      (is (= 200 (:status response)))
      (is (contains? (:body response) :missions))))
  
  (testing "import-missions handler with valid data"
    (let [import-data {:missions [{:title "Imported Mission"
                                  :category "Training"
                                  :difficulty 3
                                  :objective "Test"
                                  :mission_description "Test"
                                  :why_description "Test"}]}
          request (mock-request :post "/missions/import" :body import-data)
          response (handlers/import-missions request)]
      (is (= 200 (:status response)))
      (is (pos? (get-in response [:body :imported_count])))))
  
  (testing "import-missions handler with invalid data"
    (let [import-data {:invalid "data"}
          request (mock-request :post "/missions/import" :body import-data)
          response (handlers/import-missions request)]
      (is (= 400 (:status response))))))
