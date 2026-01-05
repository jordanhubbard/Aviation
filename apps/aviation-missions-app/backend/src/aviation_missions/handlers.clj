(ns aviation-missions.handlers
  (:require [ring.util.response :refer [response status]]
            [aviation-missions.db :as db]
            [aviation-missions.admin-auth :as admin-auth]
            [clojure.string :as str]
            [clojure.spec.alpha :as s]
            [clojure.tools.logging :as log]
            [clj-yaml.core :as yaml]))

;; Data validation specs
(s/def ::non-empty-string (s/and string? #(not (str/blank? %))))
(s/def ::title ::non-empty-string)
(s/def ::category #{"Training" "Proficiency" "Cross-Country" "Emergency"})
(s/def ::difficulty (s/int-in 1 11))
(s/def ::objective ::non-empty-string)
(s/def ::mission_description ::non-empty-string)
(s/def ::why_description ::non-empty-string)
(s/def ::notes (s/nilable string?))
(s/def ::route (s/nilable string?))
(s/def ::pilot_experience (s/nilable string?))

(s/def ::mission-data
  (s/keys :req-un [::title ::category ::difficulty ::objective
                   ::mission_description ::why_description]
          :opt-un [::notes ::route ::pilot_experience]))

;; Utility functions
(defn- extract-auth-token
  "Extract bearer token from authorization header"
  [headers]
  (when-let [auth-header (or (get headers "authorization")
                             (get headers "Authorization"))]
    (when (.startsWith ^String auth-header "Bearer ")
      (subs auth-header 7))))

(defn- validate-mission-data
  "Validate mission data against spec"
  [mission-data]
  (when-not (s/valid? ::mission-data mission-data)
    (s/explain-str ::mission-data mission-data)))

(defn- handle-error
  "Standard error response handler"
  [status-code error-message & [details]]
  (log/error error-message details)
  (-> (response (cond-> {:error error-message}
                  details (assoc :details details)))
      (status status-code)))

(defn- handle-success
  "Standard success response handler"
  [data & [status-code]]
  (-> (response data)
      (status (or status-code 200))))

;; Admin authentication middleware
(defn admin-required [handler]
  (fn [request]
    (let [token (extract-auth-token (:headers request))]
      (if (and token (db/validate-admin-session token))
        (handler request)
        (handle-error 401 "Admin authentication required")))))

(defn get-missions
  "Get all missions with filtering and sorting options"
  [request]
  (try
    (let [params (:params request)
          {:keys [category difficulty pilot_experience]} params
          missions (db/get-all-missions)
          filtered-missions (cond->> missions
                              category (filter #(= (:category %) category))
                              difficulty (filter #(= (:difficulty %) (Integer/parseInt difficulty)))
                              pilot_experience (filter #(= (:pilot_experience %) pilot_experience)))]
      (log/info "Retrieved" (count filtered-missions) "missions with filters:" params)
      (handle-success {:missions filtered-missions}))
    (catch NumberFormatException e
      (handle-error 400 "Invalid difficulty parameter" (.getMessage e)))
    (catch Exception e
      (handle-error 500 "Failed to fetch missions" (.getMessage e)))))

(defn get-mission
  "Get a specific mission by ID"
  [id]
  (try
    (let [mission-id (Integer/parseInt id)]
      (if-let [mission (db/get-mission-by-id mission-id)]
        (response {:mission mission})
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch NumberFormatException _e
      (-> (response {:error "Invalid mission ID"})
          (status 400)))
    (catch Exception e
      (-> (response {:error "Failed to fetch mission" :details (.getMessage e)})
          (status 500)))))

(defn create-mission
  "Create a new mission (admin) or submit for approval (user)"
  [request]
  (try
    (let [mission-data (:body request)
          token (extract-auth-token (:headers request))
          is-admin (and token (db/validate-admin-session token))
          validation-error (validate-mission-data mission-data)]

      (if validation-error
        (handle-error 400 "Invalid mission data" validation-error)
        (if is-admin
          ;; Admin can create directly
          (let [new-mission (db/create-mission! mission-data)]
            (log/info "Admin created mission:" (:title mission-data))
            (handle-success {:mission new-mission} 201))
          ;; Non-admin submits for approval
          (let [submission-data (assoc mission-data
                                       :submitter_name (or (:submitter_name mission-data) "Anonymous")
                                       :submitter_email (:submitter_email mission-data))]
            (db/create-submission! submission-data)
            (log/info "User submitted mission for approval:" (:title mission-data))
            (handle-success {:message "Mission submitted for approval"} 201)))))
    (catch Exception e
      (handle-error 500 "Failed to create mission" (.getMessage e)))))

(defn update-mission
  "Update an existing mission (admin) or submit update for approval (user)"
  [id request]
  (try
    (let [mission-id (Integer/parseInt id)
          mission-data (:body request)
          headers (:headers request)
          auth-header (or (get headers "authorization") (get headers "Authorization"))
          token (when auth-header (str/replace auth-header #"Bearer " ""))
          is-admin (and token (db/validate-admin-session token))]
      (if (db/get-mission-by-id mission-id)
        (if is-admin
          ;; Admin can update directly
          (let [updated-mission (db/update-mission! mission-id mission-data)]
            (response {:mission updated-mission}))
          ;; Non-admin submits update for approval
          (do
            (db/create-mission-update! mission-id (assoc mission-data 
                                                         :submitter_name (or (:submitter_name mission-data) "Anonymous")
                                                         :submitter_email (:submitter_email mission-data)))
            (-> (response {:message "Mission update submitted for approval"})
                (status 201))))
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch NumberFormatException _e
      (-> (response {:error "Invalid mission ID"})
          (status 400)))
    (catch Exception e
      (-> (response {:error "Failed to update mission" :details (.getMessage e)})
          (status 500)))))

(defn delete-mission
  "Delete a mission"
  [id]
  (try
    (let [mission-id (Integer/parseInt id)]
      (if (db/get-mission-by-id mission-id)
        (do
          (db/delete-mission! mission-id)
          (response {:message "Mission deleted successfully"}))
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch NumberFormatException _
      (-> (response {:error "Invalid mission ID"})
          (status 400)))
    (catch Exception e
      (-> (response {:error "Failed to delete mission" :details (.getMessage e)})
          (status 500)))))

(defn get-comments
  "Get comments for a mission"
  [id]
  (try
    (let [mission-id (Integer/parseInt id)]
      (if (db/get-mission-by-id mission-id)
        (let [comments (db/get-comments-for-mission mission-id)]
          (response {:comments comments}))
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch Exception e
      (-> (response {:error "Failed to fetch comments" :details (.getMessage e)})
          (status 500)))))

(defn add-comment
  "Add a comment to a mission"
  [id request]
  (try
    (let [mission-id (Integer/parseInt id)
          comment-data (:body request)]
      (if (and (db/get-mission-by-id mission-id)
               (:author_name comment-data)
               (:content comment-data))
        (let [comment (db/add-comment! mission-id comment-data)]
          (-> (response {:comment comment})
              (status 201)))
        (-> (response {:error "Mission not found or missing required fields"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to add comment" :details (.getMessage e)})
          (status 500)))))

(defn get-reviews
  "Get reviews for a mission"
  [id]
  (try
    (let [mission-id (Integer/parseInt id)]
      (if (db/get-mission-by-id mission-id)
        (let [reviews (db/get-reviews-for-mission mission-id)]
          (response {:reviews reviews}))
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch Exception e
      (-> (response {:error "Failed to fetch reviews" :details (.getMessage e)})
          (status 500)))))

(defn add-review
  "Add a review to a mission"
  [id request]
  (try
    (let [mission-id (Integer/parseInt id)
          review-data (:body request)]
      (if (and (db/get-mission-by-id mission-id)
               (:pilot_name review-data))
        (do
          (db/add-review! mission-id review-data)
          (-> (response {:message "Review added successfully"})
              (status 201)))
        (-> (response {:error "Mission not found or invalid review data"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to add review" :details (.getMessage e)})
          (status 500)))))

(defn add-rating
  "Add or update a thumbs up/down rating for a mission"
  [id request]
  (try
    (let [mission-id (Integer/parseInt id)
          rating-data (:body request)]
      (if (and (db/get-mission-by-id mission-id)
               (:pilot_name rating-data)
               (:rating rating-data)
               (contains? #{"up" "down"} (:rating rating-data)))
        (let [rating (db/add-or-update-rating! mission-id rating-data)]
          (-> (response {:rating rating})
              (status 201)))
        (-> (response {:error "Mission not found or invalid rating data"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to add rating" :details (.getMessage e)})
          (status 500)))))

(defn get-user-rating
  "Get a user's rating for a mission"
  [id pilot-name]
  (try
    (let [mission-id (Integer/parseInt id)
          decoded-name (try
                         (java.net.URLDecoder/decode (str pilot-name) "UTF-8")
                         (catch Exception _e
                           pilot-name))]
      (if-let [rating (db/get-user-rating mission-id decoded-name)]
        (response {:rating (:rating rating)})
        (response {:rating nil})))
    (catch Exception e
      (-> (response {:error "Failed to get rating" :details (.getMessage e)})
          (status 500)))))

(defn get-completions
  "Get all completions for a mission"
  [id]
  (try
    (let [mission-id (Integer/parseInt id)]
      (if (db/get-mission-by-id mission-id)
        (let [completions (db/get-completions-for-mission mission-id)]
          (response {:completions completions}))
        (-> (response {:error "Mission not found"})
            (status 404))))
    (catch Exception e
      (-> (response {:error "Failed to fetch completions" :details (.getMessage e)})
          (status 500)))))

(defn mark-completed
  "Mark a mission as completed by a pilot"
  [id request]
  (try
    (let [mission-id (Integer/parseInt id)
          completion-data (:body request)]
      (if (and (db/get-mission-by-id mission-id)
               (:pilot_name completion-data))
        (let [completion (db/mark-mission-completed! mission-id completion-data)]
          (-> (response {:completion completion})
              (status 201)))
        (-> (response {:error "Mission not found or missing required fields"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to mark mission as completed" :details (.getMessage e)})
          (status 500)))))

(defn get-submissions
  "Get all mission submissions"
  [_request]
  (try
    (let [submissions (db/get-all-submissions)]
      (response {:submissions submissions}))
    (catch Exception e
      (-> (response {:error "Failed to fetch submissions" :details (.getMessage e)})
          (status 500)))))

(defn create-submission
  "Create a new mission submission"
  [request]
  (try
    (let [submission-data (:body request)]
      (if (and (:title submission-data)
               (:category submission-data)
               (:difficulty submission-data)
               (:objective submission-data)
               (:mission_description submission-data)
               (:why_description submission-data)
               (:submitter_name submission-data))
        (do
          (db/create-submission! submission-data)
          (-> (response {:message "Mission submission created successfully"})
              (status 201)))
        (-> (response {:error "Missing required fields"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to create submission" :details (.getMessage e)})
          (status 500)))))

(defn approve-submission
  "Approve a mission submission"
  [id]
  (try
    (let [submission-id (Integer/parseInt id)]
      (db/approve-submission! submission-id)
      (response {:message "Submission approved and mission created"}))
    (catch Exception e
      (-> (response {:error "Failed to approve submission" :details (.getMessage e)})
          (status 500)))))

(defn reject-submission
  "Reject a mission submission"
  [id]
  (try
    (let [submission-id (Integer/parseInt id)]
      (db/reject-submission! submission-id "Rejected by admin")
      (response {:message "Submission rejected"}))
    (catch Exception e
      (-> (response {:error "Failed to reject submission" :details (.getMessage e)})
          (status 500)))))

;; Admin authentication
(defn admin-login
  "Admin login - supports both email-based and simple username/password"
  [request]
  (try
    (let [credentials (:body request)
          ;; Support both :admin_name (for tests/simple auth) and :email (for admin-auth)
          admin-name (:admin_name credentials)
          email (:email credentials)
          password (:password credentials)
          ;; Use simple auth if admin_name is provided, otherwise use admin-auth
          use-simple-auth? (some? admin-name)]
      
      (if use-simple-auth?
        ;; Simple username/password authentication (for tests and simple deployments)
        (let [admin-user (or (System/getenv "ADMIN_USERNAME") "admin")
              admin-pass (or (System/getenv "ADMIN_PASSWORD") "aviation123")]
          (log/info "Admin login attempt (simple auth) for:" admin-name)
          (if (and (= admin-name admin-user) (= password admin-pass))
            (let [token (db/create-admin-session! admin-name)]
              (log/info "Admin login successful:" admin-name)
              (response {:token token :admin_name admin-name}))
            (do
              (log/warn "Admin login failed for:" admin-name)
              (-> (response {:error "Invalid credentials"})
                  (status 401)))))
        
        ;; Email-based authentication using admin-auth
        (do
          (log/info "Admin login attempt (email auth) for:" email)
          (if-let [admin (admin-auth/authenticate-admin email password)]
            (if (:first_login admin)
              ;; First login - require password setup
              (-> (response {:first_login true 
                            :email (:email admin)
                            :name (:name admin)
                            :message "Please set your password"})
                  (status 200))
              ;; Regular login - create session
              (let [token (db/create-admin-session! (:email admin))]
                (log/info "Admin login successful:" (:email admin))
                (response {:token token 
                          :email (:email admin)
                          :name (:name admin)
                          :admin_name (:email admin) ;; for backward compatibility
                          :first_login false})))
            (do
              (log/warn "Admin login failed for:" email)
              (-> (response {:error "Invalid credentials"})
                  (status 401)))))))
    (catch Exception e
      (log/error e "Admin login error")
      (-> (response {:error "Login failed" :details (.getMessage e)})
          (status 500)))))

(defn check-admin-status
  "Check if current user is admin"
  [request]
  (try
    (let [headers (:headers request)
          auth-header (or (get headers "authorization") (get headers "Authorization"))
          token (when auth-header 
                  (if (.startsWith ^String auth-header "Bearer ")
                    (subs auth-header 7)
                    auth-header))
          session (and token (seq token) (db/validate-admin-session token))]
      (if session
        (response {:is_admin true 
                  :admin_name (:admin_name session)
                  :email (:admin_name session)})
        (response {:is_admin false})))
    (catch Exception e
      (-> (response {:error "Failed to check admin status" :details (.getMessage e)})
          (status 500)))))

(defn setup-admin-password
  "Set password for first-time admin login"
  [request]
  (try
    (let [data (:body request)
          email (:email data)
          password (:password data)]
      (log/info "Password setup for admin:" email)
      
      (if (and email password (>= (count password) 8))
        (if-let [admin (admin-auth/find-admin-by-email email)]
          (if (:first_login admin)
            (do
              (admin-auth/set-admin-password! email password)
              (let [token (db/create-admin-session! email)]
                (log/info "Password set successfully for:" email)
                (response {:token token
                          :email email
                          :name (:name admin)
                          :message "Password set successfully"})))
            (-> (response {:error "Admin has already set password"})
                (status 400)))
          (-> (response {:error "Admin not found"})
              (status 404)))
        (-> (response {:error "Invalid email or password (minimum 8 characters)"})
            (status 400))))
    (catch Exception e
      (log/error e "Password setup error")
      (-> (response {:error "Failed to set password" :details (.getMessage e)})
          (status 500)))))

(defn list-admin-users
  "List all admin users (admin only)"
  [_request]
  (try
    (let [admins (admin-auth/list-admins)]
      (log/info "Listing" (count admins) "admin users")
      (response {:admins admins}))
    (catch Exception e
      (log/error e "Failed to list admins")
      (-> (response {:error "Failed to list admins" :details (.getMessage e)})
          (status 500)))))

(defn create-admin-user
  "Create a new admin user (admin only)"
  [request]
  (try
    (let [data (:body request)
          name (:name data)
          email (:email data)]
      (log/info "Creating new admin:" name email)
      
      (if (and name email)
        (if (admin-auth/admin-exists? email)
          (-> (response {:error "Admin with this email already exists"})
              (status 400))
          (do
            (admin-auth/create-admin! name email)
            (log/info "Admin created successfully:" email)
            (response {:message "Admin created successfully"
                      :email email
                      :name name})))
        (-> (response {:error "Name and email are required"})
            (status 400))))
    (catch Exception e
      (log/error e "Failed to create admin")
      (-> (response {:error "Failed to create admin" :details (.getMessage e)})
          (status 500)))))

(defn delete-admin-user
  "Delete an admin user (admin only)"
  [email]
  (try
    (log/info "Deleting admin:" email)
    
    (if (admin-auth/admin-exists? email)
      (let [admin-count (admin-auth/count-admins)]
        (if (<= admin-count 1)
          (-> (response {:error "Cannot delete the last admin"})
              (status 400))
          (do
            (admin-auth/delete-admin! email)
            (log/info "Admin deleted successfully:" email)
            (response {:message "Admin deleted successfully"}))))
      (-> (response {:error "Admin not found"})
          (status 404)))
    (catch Exception e
      (log/error e "Failed to delete admin")
      (-> (response {:error "Failed to delete admin" :details (.getMessage e)})
          (status 500)))))

;; Mission update approval handlers
(defn get-mission-updates
  "Get all pending mission updates"
  [_request]
  (try
    (let [updates (db/get-all-mission-updates)]
      (response {:updates updates}))
    (catch Exception e
      (-> (response {:error "Failed to fetch updates" :details (.getMessage e)})
          (status 500)))))

(defn approve-mission-update
  "Approve a mission update"
  [id]
  (try
    (let [update-id (Integer/parseInt id)]
      (db/approve-mission-update! update-id)
      (response {:message "Mission update approved"}))
    (catch Exception e
      (-> (response {:error "Failed to approve update" :details (.getMessage e)})
          (status 500)))))

(defn reject-mission-update
  "Reject a mission update"
  [id]
  (try
    (let [update-id (Integer/parseInt id)]
      (db/reject-mission-update! update-id "Rejected by admin")
      (response {:message "Mission update rejected"}))
    (catch Exception e
      (-> (response {:error "Failed to reject update" :details (.getMessage e)})
          (status 500)))))

;; JSON Import/Export handlers
(defn export-missions
  "Export all missions as JSON"
  [_request]
  (try
    (let [missions (db/export-all-missions)]
      (response {:missions missions}))
    (catch Exception e
      (-> (response {:error "Failed to export missions" :details (.getMessage e)})
          (status 500)))))

(defn export-missions-yaml
  "Export all missions as structured YAML following the schema"
  [_request]
  (try
    (let [missions (db/export-all-missions)
          ;; Structure the data according to the schema with proper metadata
          structured-data {:aviation_missions
                          {:version "1.0"
                           :exported_at (str (java.time.Instant/now))
                           :total_missions (count missions)
                           :schema_version "1.0"
                           :missions (mapv (fn [mission]
                                            ;; Ensure all required fields are present and properly formatted
                                            (merge {:id (:id mission)
                                                   :title (:title mission)
                                                   :category (:category mission)
                                                   :difficulty (:difficulty mission)
                                                   :objective (:objective mission)
                                                   :mission_description (:mission_description mission)
                                                   :why_description (:why_description mission)
                                                   :created_at (str (:created_at mission))
                                                   :updated_at (str (:updated_at mission))}
                                                   ;; Add optional fields only if they have values
                                                   (when (:notes mission) {:notes (:notes mission)})
                                                   (when (:route mission) {:route (:route mission)})
                                                   (when (:suggested_route mission) {:suggested_route (:suggested_route mission)})
                                                   (when (:pilot_experience mission) {:pilot_experience (:pilot_experience mission)})
                                                   (when (:special_challenges mission) {:special_challenges (:special_challenges mission)})
                                                   ;; Add computed fields
                                                   {:comment_count (or (:comment_count mission) 0)
                                                    :completion_count (or (:completion_count mission) 0)
                                                    :thumbs_up (or (:thumbs_up mission) 0)
                                                    :thumbs_down (or (:thumbs_down mission) 0)}))
                                          missions)}}]
      (-> (response (yaml/generate-string structured-data {:dumper-options {:flow-style :block}}))
          (assoc-in [:headers "Content-Type"] "application/x-yaml")
          (assoc-in [:headers "Content-Disposition"] "attachment; filename=\"aviation-missions.yaml\"")))
    (catch Exception e
      (log/error e "Failed to export missions as YAML")
      (-> (response {:error "Failed to export missions as YAML" :details (.getMessage e)})
          (status 500)))))

(defn import-missions
  "Import missions from JSON"
  [request]
  (try
    (let [import-data (:body request)
          missions (:missions import-data)]
      (if (and missions (vector? missions))
        (let [imported-count (db/import-missions! missions)]
          (response {:message (str "Successfully imported " imported-count " missions")
                    :imported_count imported-count}))
        (-> (response {:error "Invalid format. Expected {\"missions\": [...]}"})
            (status 400))))
    (catch Exception e
      (-> (response {:error "Failed to import missions" :details (.getMessage e)})
          (status 500)))))

(defn import-missions-yaml
  "Import missions from YAML file"
  [request]
  (try
    (let [yaml-content (:body request)
          parsed-data (yaml/parse-string yaml-content)
          missions (get-in parsed-data [:aviation_missions :missions])]
      (if (and missions (vector? missions))
        (let [imported-count (db/import-missions! missions)]
          (response {:message (str "Successfully imported " imported-count " missions from YAML")
                    :imported_count imported-count
                    :total_in_file (count missions)}))
        (-> (response {:error "Invalid YAML format. Expected aviation_missions.missions array"})
            (status 400))))
    (catch Exception e
      (log/error e "Failed to parse YAML import")
      (-> (response {:error "Failed to import missions from YAML" :details (.getMessage e)})
          (status 500)))))
