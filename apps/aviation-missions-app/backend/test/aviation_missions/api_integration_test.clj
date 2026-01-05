(ns aviation-missions.api-integration-test
  (:require [clojure.test :refer :all]
            [ring.mock.request :as mock]
            [cheshire.core :as json]
            [aviation-missions.core :refer [app]]
            [aviation-missions.db :as db]
            [aviation-missions.handlers :as handlers]
            [clojure.java.jdbc :as jdbc])
  (:import [java.net URLEncoder]))

;; Test database configuration
(def test-db-spec
  {:classname "org.h2.Driver"
   :subprotocol "h2"
   :subname "mem:api-test-db;DB_CLOSE_DELAY=-1"
   :user "sa"
   :password ""})

(defn setup-test-db []
  (with-redefs [db/db-spec test-db-spec]
    (db/init-db!)))

(defn teardown-test-db []
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

;; Helper functions
(defn json-request [method uri body]
  (-> (mock/request method uri)
      (mock/content-type "application/json")
      (mock/body (json/generate-string body))))

(defn admin-token []
  (with-redefs [db/db-spec test-db-spec]
    (db/create-admin-session! "admin")))

(defn auth-header [token]
  {"Authorization" (str "Bearer " token)})

(defn parse-json-response [response]
  (when (:body response)
    (json/parse-string (:body response) true)))

;; Health check endpoint tests
(deftest test-health-endpoint
  (testing "Health endpoint returns system status"
    (let [response (app (mock/request :get "/health"))]
      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (= (:status body) "healthy"))
        (is (contains? body :missions_loaded))
        (is (>= (:missions_loaded body) 0)))))

;; Mission CRUD API endpoint tests
(deftest test-mission-api-endpoints
  (testing "GET /missions returns all missions"
    (let [response (app (mock/request :get "/missions"))]
      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :missions))
        (is (vector? (:missions body))))))

  (testing "POST /missions creates new mission as admin"
    (let [mission-data {:title "API Test Mission"
                       :category "Training"
                       :difficulty 5
                       :objective "Test API creation"
                       :mission_description "Test creating via API"
                       :why_description "Test API endpoints"
                       :pilot_experience "Intermediate (100-500 hours)"}
          token (admin-token)
          response (app (-> (json-request :post "/missions" mission-data)
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 201 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :mission))
        (is (= (get-in body [:mission :title]) "API Test Mission"))
        (is (some? (get-in body [:mission :id]))))))

  (testing "POST /missions creates submission as non-admin"
    (let [mission-data {:title "Submitted Mission"
                       :category "Proficiency"
                       :difficulty 3
                       :objective "Test submission"
                       :mission_description "Test non-admin submission"
                       :why_description "Test submission process"
                       :submitter_name "Test User"}
          response (app (json-request :post "/missions" mission-data))]

      (is (= 201 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :message))
        (is (.contains (:message body) "submitted for approval")))))

  (testing "GET /missions/:id returns specific mission"
    ;; First create a mission
    (let [mission (db/create-mission! {:title "Retrievable Mission"
                                      :category "Cross-Country"
                                      :difficulty 7
                                      :objective "API retrieval test"
                                      :mission_description "Test API retrieval"
                                      :why_description "Test why retrieve"})
          mission-id (:id mission)
          response (app (mock/request :get (str "/missions/" mission-id)))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :mission))
        (is (= (get-in body [:mission :id]) mission-id))
        (is (= (get-in body [:mission :title]) "Retrievable Mission")))))

  (testing "GET /missions/:id with invalid ID returns 400"
    (let [response (app (mock/request :get "/missions/invalid"))]
      (is (= 400 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error)))))

  (testing "GET /missions/:id with non-existent ID returns 404"
    (let [response (app (mock/request :get "/missions/99999"))]
      (is (= 404 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error)))))

  (testing "PUT /missions/:id updates mission as admin"
    ;; Create a mission first
    (let [mission (db/create-mission! {:title "Original Title"
                                      :category "Training"
                                      :difficulty 4
                                      :objective "Original objective"
                                      :mission_description "Original description"
                                      :why_description "Original why"})
          mission-id (:id mission)
          token (admin-token)
          update-data {:title "Updated Title"
                      :difficulty 8
                      :notes "Added notes via API"}
          response (app (-> (json-request :put (str "/missions/" mission-id) update-data)
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (= (get-in body [:mission :title]) "Updated Title"))
        (is (= (get-in body [:mission :difficulty]) 8))
        (is (= (get-in body [:mission :notes]) "Added notes via API")))))

  (testing "DELETE /missions/:id removes mission as admin"
    ;; Create a mission first
    (let [mission (db/create-mission! {:title "To Be Deleted"
                                      :category "Emergency"
                                      :difficulty 9
                                      :objective "Delete test"
                                      :mission_description "Will be deleted"
                                      :why_description "Delete test"})
          mission-id (:id mission)
          token (admin-token)
          response (app (-> (mock/request :delete (str "/missions/" mission-id))
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 200 (:status response)))

      ;; Verify mission is deleted
      (let [get-response (app (mock/request :get (str "/missions/" mission-id)))]
        (is (= 404 (:status get-response)))))))

;; Mission interaction endpoint tests
(deftest test-mission-interaction-endpoints
  (let [mission (db/create-mission! {:title "Interactive Mission"
                                    :category "Training"
                                    :difficulty 5
                                    :objective "Interaction test"
                                    :mission_description "Test interactions"
                                    :why_description "Test why interact"})
        mission-id (:id mission)]

    (testing "POST /missions/:id/comments adds comment"
      (let [comment-data {:author_name "Test Pilot" :content "Great mission!"}
            response (app (json-request :post (str "/missions/" mission-id "/comments") comment-data))]

        (is (= 201 (:status response)))
        (let [body (parse-json-response response)]
          (is (contains? body :comment))
          (is (= (get-in body [:comment :content]) "Great mission!")))))

    (testing "GET /missions/:id/comments retrieves comments"
      (let [response (app (mock/request :get (str "/missions/" mission-id "/comments")))]

        (is (= 200 (:status response)))
        (let [body (parse-json-response response)]
          (is (contains? body :comments))
          (is (> (count (:comments body)) 0)))))

    (testing "POST /missions/:id/rating adds rating"
      (let [rating-data {:pilot_name "Test Pilot" :rating "up"}
            response (app (json-request :post (str "/missions/" mission-id "/rating") rating-data))]

        (is (= 201 (:status response)))
        (let [body (parse-json-response response)]
          (is (contains? body :rating))
          (is (= (get-in body [:rating :rating]) "up")))))

    (testing "GET /missions/:id/rating/:pilot_name retrieves user rating"
      (let [encoded-name (URLEncoder/encode "Test Pilot" "UTF-8")
            response (app (mock/request :get (str "/missions/" mission-id "/rating/" encoded-name)))]

        (is (= 200 (:status response)))
        (let [body (parse-json-response response)]
          (is (= (:rating body) "up")))))

    (testing "POST /missions/:id/completed marks mission as completed"
      (let [completion-data {:pilot_name "Test Pilot" :notes "Completed successfully"}
            response (app (json-request :post (str "/missions/" mission-id "/completed") completion-data))]

        (is (= 201 (:status response)))
        (let [body (parse-json-response response)]
          (is (contains? body :completion)))))

    (testing "GET /missions/:id/completed retrieves completions"
      (let [response (app (mock/request :get (str "/missions/" mission-id "/completed")))]

        (is (= 200 (:status response)))
        (let [body (parse-json-response response)]
          (is (contains? body :completions))
          (is (> (count (:completions body)) 0)))))))

;; Admin authentication tests
(deftest test-admin-authentication
  (testing "POST /admin/login with valid credentials"
    (let [credentials {:admin_name "admin" :password "aviation123"}
          response (app (json-request :post "/admin/login" credentials))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :token))
        (is (string? (:token body)))
        (is (> (count (:token body)) 10)))))

  (testing "POST /admin/login with invalid credentials"
    (let [credentials {:admin_name "wrong" :password "wrong"}
          response (app (json-request :post "/admin/login" credentials))]

      (is (= 401 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error)))))

  (testing "GET /admin/status with valid token"
    (let [token (admin-token)
          response (app (-> (mock/request :get "/admin/status")
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (true? (:is_admin body))))))

  (testing "GET /admin/status without token"
    (let [response (app (mock/request :get "/admin/status"))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (false? (:is_admin body)))))))

;; Mission submission workflow tests
(deftest test-mission-submission-workflow
  (testing "Complete submission workflow"
    ;; Create submission
    (let [submission-data {:title "Workflow Test Mission"
                          :category "Cross-Country"
                          :difficulty 6
                          :objective "Test workflow"
                          :mission_description "Test submission workflow"
                          :why_description "Test why workflow"
                          :submitter_name "Test Submitter"}
          response (app (json-request :post "/submissions" submission-data))]

      (is (= 201 (:status response)))

      ;; Get submissions as admin
      (let [token (admin-token)
            submissions-response (app (-> (mock/request :get "/submissions")
                                         (mock/header "Authorization" (str "Bearer " token))))
            submissions-body (parse-json-response submissions-response)]

        (is (= 200 (:status submissions-response)))
        (is (contains? submissions-body :submissions))
        (is (> (count (:submissions submissions-body)) 0))

        ;; Find our submission
        (let [our-submission (first (filter #(= (:title %) "Workflow Test Mission")
                                           (:submissions submissions-body)))
              submission-id (:id our-submission)]

          (is (some? our-submission))

          ;; Approve submission
          (let [approve-response (app (-> (mock/request :put (str "/submissions/" submission-id "/approve"))
                                         (mock/header "Authorization" (str "Bearer " token))))]

            (is (= 200 (:status approve-response)))

            ;; Verify mission was created
            (let [missions-response (app (mock/request :get "/missions"))
                  missions-body (parse-json-response missions-response)
                  created-mission (first (filter #(= (:title %) "Workflow Test Mission")
                                                 (:missions missions-body)))]

              (is (some? created-mission))
              (is (= (:category created-mission) "Cross-Country")))))))))

;; Import/Export API tests
(deftest test-import-export-endpoints
  (testing "Export missions as JSON"
    ;; Create some test missions first
    (db/create-mission! {:title "Export Test 1"
                        :category "Training"
                        :difficulty 3
                        :objective "Export test"
                        :mission_description "Test export"
                        :why_description "Test why export"})

    (let [token (admin-token)
          response (app (-> (mock/request :get "/missions/export")
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :missions))
        (is (> (count (:missions body)) 0)))))

  (testing "Import missions from JSON"
    (let [import-data {:missions [{:title "Imported Test Mission"
                                  :category "Proficiency"
                                  :difficulty 4
                                  :objective "Import test"
                                  :mission_description "Test import"
                                  :why_description "Test why import"}]}
          token (admin-token)
          response (app (-> (json-request :post "/missions/import" import-data)
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (pos? (:imported_count body))))))

  (testing "Export/Import requires admin privileges"
    (let [export-response (app (mock/request :get "/missions/export"))
          import-data {:missions []}
          import-response (app (json-request :post "/missions/import" import-data))]

      (is (= 401 (:status export-response)))
      (is (= 401 (:status import-response))))))

;; Data validation tests
(deftest test-api-data-validation
  (testing "Mission creation with missing required fields"
    (let [incomplete-mission {:title "Incomplete"}
          token (admin-token)
          response (app (-> (json-request :post "/missions" incomplete-mission)
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 400 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error)))))

  (testing "Mission creation with invalid difficulty"
    (let [invalid-mission {:title "Invalid Difficulty"
                          :category "Training"
                          :difficulty 15  ; Invalid - should be 1-10
                          :objective "Test invalid"
                          :mission_description "Test invalid difficulty"
                          :why_description "Test why invalid"}
          token (admin-token)
          response (app (-> (json-request :post "/missions" invalid-mission)
                           (mock/header "Authorization" (str "Bearer " token))))]

      (is (= 400 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error)))))

  (testing "Rating with invalid value"
    (let [mission (db/create-mission! {:title "Rating Test"
                                      :category "Training"
                                      :difficulty 5
                                      :objective "Test rating"
                                      :mission_description "Test invalid rating"
                                      :why_description "Test why rating"})
          mission-id (:id mission)
          invalid-rating {:pilot_name "Test" :rating "invalid"}
          response (app (json-request :post (str "/missions/" mission-id "/rating") invalid-rating))]

      (is (= 400 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :error))))))

;; Error handling tests
(deftest test-error-handling
  (testing "Malformed JSON request"
    (let [response (app (-> (mock/request :post "/missions")
                           (mock/content-type "application/json")
                           (mock/body "invalid json")))]

      (is (>= (:status response) 400))))

  (testing "Missing Content-Type header"
    (let [mission-data {:title "Test" :category "Training" :difficulty 5
                       :objective "Test" :mission_description "Test" :why_description "Test"}
          response (app (-> (mock/request :post "/missions")
                           (mock/body (json/generate-string mission-data))))]

      ;; Should still work or return appropriate error
      (is (or (= 201 (:status response))
              (>= (:status response) 400)))))

  (testing "Very large request body"
    (let [huge-string (apply str (repeat 10000 "A"))
          large-mission {:title huge-string
                        :category "Training"
                        :difficulty 5
                        :objective "Test large"
                        :mission_description huge-string
                        :why_description "Test large"}
          token (admin-token)
          response (app (-> (json-request :post "/missions" large-mission)
                           (mock/header "Authorization" (str "Bearer " token))))]

      ;; Should handle gracefully (either accept or reject cleanly)
      (is (or (= 201 (:status response))
              (>= (:status response) 400))))))

;; Swagger documentation tests
(deftest test-swagger-endpoints
  (testing "GET /swagger.json returns API specification"
    (let [response (app (mock/request :get "/swagger.json"))]

      (is (= 200 (:status response)))
      (let [body (parse-json-response response)]
        (is (contains? body :swagger))
        (is (contains? body :info))
        (is (contains? body :paths)))))

  (testing "GET /api returns Swagger UI"
    (let [response (app (mock/request :get "/api"))]

      (is (= 200 (:status response)))
      (is (.contains (:body response) "swagger-ui"))
      (is (.contains (:body response) "Aviation Mission Management API Documentation")))))

;; Static file serving tests
(deftest test-static-file-serving
  (testing "GET / returns frontend index.html"
    (let [response (app (mock/request :get "/"))]

      ;; Should return HTML or 404 if static files not available in test
      (is (or (= 200 (:status response))
              (= 404 (:status response))))))

  (testing "GET /some-frontend-route returns index.html (SPA routing)"
    (let [response (app (mock/request :get "/some-frontend-route"))]

      ;; Should return HTML or 404 if static files not available in test
      (is (or (= 200 (:status response))
              (= 404 (:status response)))))))

;; Performance tests
(deftest test-api-performance
  (testing "Multiple concurrent requests"
    (let [mission-data {:title "Performance Test"
                       :category "Training"
                       :difficulty 5
                       :objective "Performance test"
                       :mission_description "Test performance"
                       :why_description "Test why performance"}
          mission (db/create-mission! mission-data)
          mission-id (:id mission)

          start-time (System/currentTimeMillis)
          responses (doall (pmap (fn [_]
                                  (app (mock/request :get (str "/missions/" mission-id))))
                                (range 50)))
          end-time (System/currentTimeMillis)
          duration (- end-time start-time)]

      ;; All requests should succeed
      (is (every? #(= 200 (:status %)) responses))

      ;; Should complete within reasonable time
      (is (< duration 10000) "50 concurrent requests should complete within 10 seconds")))))