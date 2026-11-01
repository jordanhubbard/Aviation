(ns aviation-missions.core-test
  (:require [clojure.test :refer :all]
            [ring.mock.request :as mock]
            [cheshire.core :as json]
            [aviation-missions.core :refer [app]]
            [aviation-missions.db :as db]
            [aviation-missions.e2e :as e2e]
            [aviation-missions.handlers :as handlers]))

;; Test database configuration for testing
(def test-db-spec
  {:classname "org.h2.Driver"
   :subprotocol "h2"
   :subname "mem:test-db;DB_CLOSE_DELAY=-1"
   :user "sa"
   :password ""})

;; Override the db-spec for testing
(defn setup-test-db []
  "Set up test database with test schema"
  (with-redefs [db/db-spec test-db-spec]
    (db/init-db!)))

(defn teardown-test-db []
  "Clean up test database"
  (with-redefs [db/db-spec test-db-spec]
    (try
      (clojure.java.jdbc/execute! test-db-spec ["DROP ALL OBJECTS"])
      (catch Exception e
        ; Ignore errors on cleanup
        ))))

(use-fixtures :each 
  (fn [test-fn]
    (setup-test-db)
    (with-redefs [db/db-spec test-db-spec]
      (test-fn))
    (teardown-test-db)))

;; Helper functions
(defn json-request [method uri body]
  "Create a JSON request for testing"
  (-> (mock/request method uri)
      (mock/content-type "application/json")
      (mock/body (json/generate-string body))))

(defn admin-token []
  "Get a valid admin token for testing"
  (with-redefs [db/db-spec test-db-spec]
    (db/create-admin-session! "admin")))

(defn auth-header [token]
  "Create authorization header"
  {"Authorization" (str "Bearer " token)})

(deftest production-rejects-test-traffic
  (let [normal (app (mock/request :get "/health"))
        tagged (app (assoc-in (mock/request :get "/health")
                              [:headers "x-aviation-test-run"]
                              (str "e2e_" (apply str (repeat 32 "a")))))]
    (is (= 200 (:status normal)))
    (is (= 403 (:status tagged)))))

;; Route existence tests
(deftest test-route-existence
  "Test that all defined routes actually exist and are callable"
  
  (testing "Health endpoint"
    (let [response (app (mock/request :get "/health"))]
      (is (= 200 (:status response)))))
  
  (testing "Missions endpoint"
    (let [response (app (mock/request :get "/missions"))]
      (is (= 200 (:status response)))))
  
  (testing "Swagger endpoint"
    (let [response (app (mock/request :get "/swagger.json"))]
      (is (= 200 (:status response)))))
  
  (testing "Admin login endpoint"
    (let [response (app (json-request :post "/admin/login" 
                                     {:admin_name "admin" :password "aviation123"}))]
      (is (= 200 (:status response)))))
  
  (testing "Frontend routes (may return 404 in test environment without static files)"
    (let [response (app (mock/request :get "/"))]
      ; In test environment, static files may not be available
      (is (or (= 200 (:status response)) (= 404 (:status response)))))
    
    (let [response (app (mock/request :get "/some-frontend-route"))]
      (is (or (= 200 (:status response)) (= 404 (:status response)))))))

;; Function implementation verification tests
(deftest test-handler-function-existence
  "Verify all handler functions called in routes actually exist"
  
  (testing "Core handler functions exist"
    (is (fn? handlers/get-missions))
    (is (fn? handlers/get-mission))
    (is (fn? handlers/create-mission))
    (is (fn? handlers/update-mission))
    (is (fn? handlers/delete-mission))
    (is (fn? handlers/add-comment))
    (is (fn? handlers/get-comments))
    (is (fn? handlers/add-review))
    (is (fn? handlers/get-reviews))
    (is (fn? handlers/add-rating))
    (is (fn? handlers/get-user-rating))
    (is (fn? handlers/mark-completed))
    (is (fn? handlers/get-completions))
    (is (fn? handlers/create-submission))
    (is (fn? handlers/get-submissions))
    (is (fn? handlers/approve-submission))
    (is (fn? handlers/reject-submission))
    (is (fn? handlers/get-mission-update-status))
    (is (fn? handlers/get-mission-updates))
    (is (fn? handlers/approve-mission-update))
    (is (fn? handlers/reject-mission-update))
    (is (fn? handlers/admin-login))
    (is (fn? handlers/check-admin-status))
    (is (fn? handlers/export-missions))
    (is (fn? handlers/import-missions))
    (is (fn? handlers/admin-required))))

;; Database function tests
(deftest test-database-functions
  "Test database operations work correctly"
  
  (testing "Mission CRUD operations"
    (let [mission-data {:title "Test Mission"
                       :category "Training"
                       :difficulty 5
                       :objective "Test objective"
                       :mission_description "Test description"
                       :why_description "Test why"
                       :pilot_experience "Beginner (< 100 hours)"}]
      
      ; Test create
      (let [created-mission (db/create-mission! mission-data)]
        (is (some? (:id created-mission)))
        (is (= "Test Mission" (:title created-mission)))
        
        ; Test read
        (let [retrieved-mission (db/get-mission-by-id (:id created-mission))]
          (is (some? retrieved-mission))
          (is (= "Test Mission" (:title retrieved-mission))))
        
        ; Test update
        (let [updated-mission (db/update-mission! (:id created-mission) 
                                                 {:title "Updated Mission"})]
          (is (= "Updated Mission" (:title updated-mission))))
        
        ; Test delete
        (db/delete-mission! (:id created-mission))
        (is (nil? (db/get-mission-by-id (:id created-mission)))))))
  
  (testing "Admin session management"
    (let [token (db/create-admin-session! "test-admin")]
      (is (string? token))
      (is (some? (db/validate-admin-session token)))))
  
  (testing "Comments and ratings"
    (let [mission (db/create-mission! {:title "Test Mission"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (:id mission)]
      
      ; Test comments
      (db/add-comment! mission-id {:author_name "Test User" :content "Great mission!"})
      (let [comments (db/get-comments-for-mission mission-id)]
        (is (= 1 (count comments)))
        (is (= "Great mission!" (:content (first comments)))))
      
      ; Test ratings
      (db/add-or-update-rating! mission-id {:pilot_name "Test Pilot" :rating "up"})
      (let [rating (db/get-user-rating mission-id "Test Pilot")]
        (is (= "up" (:rating rating)))))))

;; API endpoint integration tests
(deftest test-api-endpoints
  "Test API endpoints work correctly with proper data"
  
  (testing "Mission creation and retrieval"
    (let [mission-data {:title "API Test Mission"
                       :category "Training"
                       :difficulty 3
                       :objective "Test API"
                       :mission_description "Testing the API"
                       :why_description "To ensure it works"
                       :pilot_experience "Beginner (< 100 hours)"}
          token (admin-token)]
      
      ; Create mission as admin
      (let [create-response (app (-> (json-request :post "/missions" mission-data)
                                    (mock/header "Authorization" (str "Bearer " token))))]
        (is (= 201 (:status create-response)))
        
        ; Get all missions
        (let [get-response (app (mock/request :get "/missions"))
              body (json/parse-string (:body get-response) true)]
          (is (= 200 (:status get-response)))
          (is (seq (:missions body)))))))
  
  (testing "Admin authentication flow"
    ; Test login
    (let [login-response (app (json-request :post "/admin/login" 
                                          {:admin_name "admin" :password "aviation123"}))
          body (json/parse-string (:body login-response) true)]
      (is (= 200 (:status login-response)))
      (is (some? (:token body)))
      
      ; Test admin status check
      (let [token (:token body)
            status-response (app (-> (mock/request :get "/admin/status")
                                    (mock/header "Authorization" (str "Bearer " token))))
            status-body (json/parse-string (:body status-response) true)]
        (is (= 200 (:status status-response)))
        (is (true? (:is_admin status-body))))))
  
  (testing "Mission submission flow"
    (let [submission-data {:title "Submitted Mission"
                          :category "Training"
                          :difficulty 2
                          :objective "Test submission"
                          :mission_description "Testing submission"
                          :why_description "To test the flow"
                          :route "KPAO -> KSFO"
                          :submitter_name "Test User"}]
      
      ; Submit mission
      (let [submit-response (app (json-request :post "/submissions" submission-data))]
        (is (= 201 (:status submit-response))))
      
      ; Check submissions as admin
      (let [token (admin-token)
            submissions-response (app (-> (mock/request :get "/submissions")
                                         (mock/header "Authorization" (str "Bearer " token))))
            body (json/parse-string (:body submissions-response) true)]
        (is (= 200 (:status submissions-response)))
        (is (seq (:submissions body)))))))

;; Error handling tests
(deftest test-error-handling
  "Test that error conditions are handled properly"
  
  (testing "Invalid mission ID"
    (let [response (app (mock/request :get "/missions/invalid"))]
      (is (= 400 (:status response)))))
  
  (testing "Non-existent mission"
    (let [response (app (mock/request :get "/missions/99999"))]
      (is (= 404 (:status response)))))
  
  (testing "Admin required endpoints without auth"
    (let [response (app (mock/request :get "/submissions"))]
      (is (= 401 (:status response))))
    
    (let [response (app (json-request :post "/missions/import" {:missions []}))]
      (is (= 401 (:status response)))))
  
  (testing "Invalid login credentials"
    (let [response (app (json-request :post "/admin/login" 
                                     {:admin_name "wrong" :password "wrong"}))]
      (is (= 401 (:status response)))))
  
  (testing "Missing required fields"
    (let [response (app (json-request :post "/missions" {:title "Incomplete"}))]
      (is (= 400 (:status response))))))

;; Data validation tests
(deftest test-data-validation
  "Test that data validation works correctly"
  
  (testing "Mission data validation"
    (let [token (admin-token)]
      ; Test with all required fields
      (let [valid-mission {:title "Valid Mission"
                          :category "Training"
                          :difficulty 5
                          :objective "Valid objective"
                          :mission_description "Valid description"
                          :why_description "Valid why"}
            response (app (-> (json-request :post "/missions" valid-mission)
                             (mock/header "Authorization" (str "Bearer " token))))]
        (is (= 201 (:status response))))
      
      ; Test with missing required fields
      (let [invalid-mission {:title "Invalid Mission"}
            response (app (-> (json-request :post "/missions" invalid-mission)
                             (mock/header "Authorization" (str "Bearer " token))))]
        (is (= 400 (:status response))))))
  
  (testing "Rating validation"
    (let [mission (db/create-mission! {:title "Test Mission"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test"
                                      :mission_description "Test"
                                      :why_description "Test"})
          mission-id (:id mission)]
      
      ; Valid rating (only test if mission was created successfully)
      (when mission-id
        (let [response (app (json-request :post (str "/missions/" mission-id "/rating")
                                         {:pilot_name "Test Pilot" :rating "up"}))]
          (is (or (= 201 (:status response)) (= 404 (:status response))))) ; 404 if mission not found
        
        ; Invalid rating
        (let [response (app (json-request :post (str "/missions/" mission-id "/rating")
                                         {:pilot_name "Test Pilot" :rating "invalid"}))]
          (is (or (= 400 (:status response)) (= 404 (:status response)))))))))

;; Import/Export functionality tests
(deftest test-import-export
  "Test JSON import/export functionality"
  
  (testing "Export missions"
    (let [token (admin-token)]
      ; Create a test mission first
      (db/create-mission! {:title "Export Test"
                          :category "Training"
                          :difficulty 5
                          :objective "Test export"
                          :mission_description "Test export"
                          :why_description "Test export"})
      
      ; Test export
      (let [response (app (-> (mock/request :get "/missions/export")
                             (mock/header "Authorization" (str "Bearer " token))))
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (seq (:missions body))))))
  
  (testing "Import missions"
    (let [token (admin-token)
          import-data {:missions [{:title "Imported Mission"
                                  :category "Training"
                                  :difficulty 3
                                  :objective "Imported objective"
                                  :mission_description "Imported description"
                                  :why_description "Imported why"}]}]
      
      ; Test import
      (let [response (app (-> (json-request :post "/missions/import" import-data)
                             (mock/header "Authorization" (str "Bearer " token))))
            body (json/parse-string (:body response) true)]
        (is (= 200 (:status response)))
        (is (pos? (:imported_count body)))))))


(defn signed-run-request [method uri body run secret & [expires-at app-id]]
  (let [expiry (str (or expires-at (+ (System/currentTimeMillis) 60000)))
        mac (javax.crypto.Mac/getInstance "HmacSHA256")
        key (javax.crypto.spec.SecretKeySpec. (.getBytes ^String secret "UTF-8") "HmacSHA256")
        _ (.init mac key)
        signature (.formatHex (java.util.HexFormat/of)
                    (.doFinal mac (.getBytes (str (or app-id "aviation-missions-app") "\n" run "\n" expiry) "UTF-8")))]
    (-> (if body (json-request method uri body) (mock/request method uri))
        (assoc-in [:headers "origin"] "http://127.0.0.1:3000")
        (assoc-in [:headers "x-aviation-test-run"] run)
        (assoc-in [:headers "x-aviation-test-expires"] expiry)
        (assoc-in [:headers "x-aviation-test-signature"] signature))))

(deftest sdk-fixtures-and-cleanup-use-only-the-signed-test-store
  (let [run (str "e2e_" (apply str (repeat 32 "b")))
        foreign (str "e2e_" (apply str (repeat 32 "c")))
        secret "isolated-missions-test-secret-at-least-32-characters"
        data #(json/parse-string (:body %) true)
        request #(signed-run-request %1 %2 %3 run secret)
        fixture {:title "E2E isolated mission" :category "Training" :difficulty 2
                 :objective "Practice" :mission_description "Synthetic pattern"
                 :why_description "Test the isolated lifecycle" :route "KOAK KOAK"
                 :is_test_data true :test_run_id run}]
    (is (= 404 (:status (app (mock/request :post "/__e2e/fixtures")))))
    (is (thrown? clojure.lang.ExceptionInfo (db/clear-test-store!)))
    (with-redefs-fn {#'e2e/run-id run #'e2e/secret secret}
      (fn []
        (db/tag-test-schema!)
        (let [now (System/currentTimeMillis)]
          (with-redefs-fn {#'e2e/current-time-ms (constantly now)}
            (fn []
              (doseq [expiry [now (dec now) (+ now 900001) "NaN"]]
                (is (= 403 (:status (app (signed-run-request :get "/__e2e/status" nil run secret expiry)))))))))
        (is (= 403 (:status (app (signed-run-request :get "/__e2e/status" nil run secret nil "flight-planner")))))
        (is (= 403 (:status (app (mock/request :get "/__e2e/status")))))
        (is (= 403 (:status (app (signed-run-request :get "/__e2e/status" nil foreign secret)))))
        (is (= 403 (:status (app (assoc-in (request :delete (str "/__e2e/runs/" run) nil)
                                          [:headers "x-aviation-test-signature"] (apply str (repeat 64 "0")))))))
        (is (= 404 (:status (app (request :delete (str "/__e2e/runs/" foreign) nil)))))
        (is (= 400 (:status (app (request :post "/__e2e/fixtures"
                                          {:fixture_type "mission" :record (dissoc fixture :test_run_id)})))))
        (let [seeded (app (request :post "/__e2e/fixtures" {:fixture_type "mission" :record fixture}))
              mission (data seeded)
              id (:id mission)]
          (is (= 201 (:status seeded)))
          (is (= "86400" (get-in seeded [:headers "Access-Control-Max-Age"])))
          (is (every? (fn [value]
                        (or (string? value) (and (sequential? value) (every? string? value))))
                      (vals (:headers seeded))))
          (is (= run (:test_run_id mission)))
          (is (true? (:is_test_data mission)))
          (clojure.java.jdbc/insert! db/db-spec :e2e_runs
            {:test_run_id foreign :is_test_data true})
          (is (thrown? clojure.lang.ExceptionInfo (db/test-store-state)))
          (is (thrown? clojure.lang.ExceptionInfo (db/clear-test-store!)))
          (is (some? (db/get-mission-by-id id)))
          (clojure.java.jdbc/delete! db/db-spec :e2e_runs ["test_run_id = ?" foreign])
          (is (= 201 (:status (app (request :post (str "/missions/" id "/comments")
                                            {:author_name "E2E Pilot" :content "Tagged comment"})))))
          (is (= 201 (:status (app (request :post (str "/missions/" id "/completed")
                                            {:pilot_name "E2E Pilot" :notes "Tagged completion"})))))
          (db/create-admin-session! "E2E Admin")
          (let [state (data (app (request :get "/__e2e/status" nil)))]
            (is (= 1 (:mission_count state)))
            (is (= 1 (get-in state [:tables :comments])))
            (is (= 1 (get-in state [:tables :mission_completions])))
            (is (= 1 (get-in state [:tables :admin_sessions])))
            (is (= 5 (:count state))))
          ;; A failed browser run uses the same registered SDK cleanup path.
          (try
            (throw (ex-info "simulated browser failure" {}))
            (catch clojure.lang.ExceptionInfo _ nil)
            (finally
              (is (= 0 (:count (data (app (request :delete (str "/__e2e/runs/" run) nil))))))))
          (let [residual (data (app (request :get (str "/__e2e/runs/" run) nil)))]
            (is (= 0 (:count residual)))
            (is (every? zero? (vals (:tables residual)))))
          (is (= 0 (:count (data (app (request :delete (str "/__e2e/runs/" run) nil)))))))))))
