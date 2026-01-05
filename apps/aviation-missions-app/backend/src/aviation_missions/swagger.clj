(ns aviation-missions.swagger
  (:require [ring.util.response :refer [response]]))

(def swagger-spec
  (response
    {:swagger "2.0"
     :info {:title "Aviation Mission Management API"
            :version "1.0.0"
            :description "API for managing general aviation training missions"}
     :host "localhost:3000"
     :basePath "/"
     :schemes ["http" "https"]
     :consumes ["application/json"]
     :produces ["application/json"]
     :paths
     {"/missions"
      {:get {:summary "Get all missions"
             :description "Retrieve all aviation missions with optional filtering"
             :parameters [{:name "category"
                          :in "query"
                          :type "string"
                          :description "Filter by mission category"}
                         {:name "difficulty"
                          :in "query"
                          :type "integer"
                          :description "Filter by difficulty level (1-10)"}
                         {:name "pilot_experience"
                          :in "query"
                          :type "string"
                          :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"]
                          :description "Filter by pilot experience level"}
                         {:name "sort"
                          :in "query"
                          :type "string"
                          :description "Sort by field (difficulty, title, category)"}]
             :responses {200 {:description "List of missions"
                             :schema {:type "object"
                                     :properties {:missions {:type "array"
                                                            :items {:$ref "#/definitions/Mission"}}}}}}}
       :post {:summary "Create a new mission"
              :description "Create a new aviation mission"
              :parameters [{:name "mission"
                           :in "body"
                           :required true
                           :schema {:$ref "#/definitions/NewMission"}}]
              :responses {201 {:description "Mission created successfully"
                              :schema {:type "object"
                                      :properties {:mission {:$ref "#/definitions/Mission"}}}}
                         400 {:description "Invalid input"}}}}
      
      "/missions/export"
      {:get {:summary "Export all missions"
             :description "Export all missions as JSON (admin only)"
             :security [{"BearerAuth" []}]
             :responses {200 {:description "Missions exported successfully"
                             :schema {:type "object"
                                     :properties {:missions {:type "array"
                                                            :items {:$ref "#/definitions/Mission"}}}}}
                        401 {:description "Admin authentication required"}}}}
      
      "/missions/import"
      {:post {:summary "Import missions from JSON"
              :description "Import missions from JSON data (admin only)"
              :security [{"BearerAuth" []}]
              :parameters [{:name "import_data"
                           :in "body"
                           :required true
                           :schema {:type "object"
                                   :properties {:missions {:type "array"
                                                          :items {:$ref "#/definitions/ImportMission"}}}}}]
              :responses {200 {:description "Missions imported successfully"
                              :schema {:type "object"
                                      :properties {:message {:type "string"}
                                                  :imported_count {:type "integer"}}}}
                         400 {:description "Invalid import data"}
                         401 {:description "Admin authentication required"}}}}
      
      "/missions/{id}"
      {:get {:summary "Get mission by ID"
             :description "Retrieve a specific mission by its ID"
             :parameters [{:name "id"
                          :in "path"
                          :required true
                          :type "integer"}]
             :responses {200 {:description "Mission details"
                             :schema {:type "object"
                                     :properties {:mission {:$ref "#/definitions/Mission"}}}}
                        404 {:description "Mission not found"}}}
       :put {:summary "Update mission"
             :description "Update an existing mission"
             :parameters [{:name "id"
                          :in "path"
                          :required true
                          :type "integer"}
                         {:name "mission"
                          :in "body"
                          :required true
                          :schema {:$ref "#/definitions/NewMission"}}]
             :responses {200 {:description "Mission updated successfully"}
                        404 {:description "Mission not found"}}}
       :delete {:summary "Delete mission"
                :description "Delete a mission"
                :parameters [{:name "id"
                             :in "path"
                             :required true
                             :type "integer"}]
                :responses {200 {:description "Mission deleted successfully"}
                           404 {:description "Mission not found"}}}}
      
      "/missions/{id}/comments"
      {:get {:summary "Get mission comments"
             :description "Retrieve comments for a specific mission"
             :parameters [{:name "id"
                          :in "path"
                          :required true
                          :type "integer"}]
             :responses {200 {:description "List of comments"
                             :schema {:type "object"
                                     :properties {:comments {:type "array"
                                                            :items {:$ref "#/definitions/Comment"}}}}}}}
       :post {:summary "Add comment to mission"
              :description "Add a new comment to a mission"
              :parameters [{:name "id"
                           :in "path"
                           :required true
                           :type "integer"}
                          {:name "comment"
                           :in "body"
                           :required true
                           :schema {:$ref "#/definitions/NewComment"}}]
              :responses {201 {:description "Comment added successfully"}
                         400 {:description "Invalid input"}}}}
      
      "/missions/{id}/reviews"
      {:get {:summary "Get mission reviews"
             :description "Retrieve reviews for a specific mission"
             :parameters [{:name "id"
                          :in "path"
                          :required true
                          :type "integer"}]
             :responses {200 {:description "List of reviews"
                             :schema {:type "object"
                                     :properties {:reviews {:type "array"
                                                           :items {:$ref "#/definitions/Review"}}}}}}}
       :post {:summary "Add review to mission"
              :description "Add a new review to a mission"
              :parameters [{:name "id"
                           :in "path"
                           :required true
                           :type "integer"}
                          {:name "review"
                           :in "body"
                           :required true
                           :schema {:$ref "#/definitions/NewReview"}}]
              :responses {201 {:description "Review added successfully"}
                         400 {:description "Invalid input"}}}}
      
      "/submissions"
      {:get {:summary "Get all submissions"
             :description "Retrieve all mission submissions (admin only)"
             :responses {200 {:description "List of submissions"
                             :schema {:type "object"
                                     :properties {:submissions {:type "array"
                                                               :items {:$ref "#/definitions/Submission"}}}}}}}
       :post {:summary "Submit new mission"
              :description "Submit a new mission for review"
              :parameters [{:name "submission"
                           :in "body"
                           :required true
                           :schema {:$ref "#/definitions/NewSubmission"}}]
              :responses {201 {:description "Submission created successfully"}
                         400 {:description "Invalid input"}}}}}
     
     :definitions
     {:Mission
      {:type "object"
       :properties {:id {:type "integer"}
                   :title {:type "string"}
                   :category {:type "string"}
                   :difficulty {:type "integer" :minimum 1 :maximum 10}
                   :objective {:type "string"}
                   :mission_description {:type "string"}
                   :why_description {:type "string"}
                   :notes {:type "string"}
                   :route {:type "string"}
                   :suggested_route {:type "string"}
                   :pilot_experience {:type "string" :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"]}
                   :comment_count {:type "integer"}
                   :completion_count {:type "integer"}
                   :thumbs_up {:type "integer"}
                   :thumbs_down {:type "integer"}
                   :created_at {:type "string" :format "date-time"}
                   :updated_at {:type "string" :format "date-time"}}}
      
      :NewMission
      {:type "object"
       :required [:title :category :difficulty :objective :mission_description :why_description :pilot_experience]
       :properties {:title {:type "string"}
                   :category {:type "string"}
                   :difficulty {:type "integer" :minimum 1 :maximum 10}
                   :objective {:type "string"}
                   :mission_description {:type "string"}
                   :why_description {:type "string"}
                   :notes {:type "string"}
                   :route {:type "string"}
                   :pilot_experience {:type "string" :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"]}
}}
      
      :Comment
      {:type "object"
       :properties {:id {:type "integer"}
                   :mission_id {:type "integer"}
                   :author_name {:type "string"}
                   :content {:type "string"}
                   :created_at {:type "string" :format "date-time"}}}
      
      :NewComment
      {:type "object"
       :required [:author_name :content]
       :properties {:author_name {:type "string"}
                   :content {:type "string"}}}
      
      :Review
      {:type "object"
       :properties {:id {:type "integer"}
                   :mission_id {:type "integer"}
                   :pilot_name {:type "string"}
                   :rating {:type "integer" :minimum 1 :maximum 10}
                   :review_text {:type "string"}
                   :flight_date {:type "string" :format "date"}
                   :created_at {:type "string" :format "date-time"}}}
      
      :NewReview
      {:type "object"
       :required [:pilot_name :rating]
       :properties {:pilot_name {:type "string"}
                   :rating {:type "integer" :minimum 1 :maximum 10}
                   :review_text {:type "string"}
                   :flight_date {:type "string" :format "date"}}}
      
      :Submission
      {:type "object"
       :properties {:id {:type "integer"}
                   :title {:type "string"}
                   :category {:type "string"}
                   :difficulty {:type "integer"}
                   :objective {:type "string"}
                   :mission_description {:type "string"}
                   :why_description {:type "string"}
                   :notes {:type "string"}
                   :route {:type "string"}
                   :pilot_experience {:type "string" :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"]}
                   :submitter_name {:type "string"}
                   :submitter_email {:type "string"}
                   :status {:type "string" :enum ["pending" "approved" "rejected"]}
                   :admin_notes {:type "string"}
                   :created_at {:type "string" :format "date-time"}
                   :reviewed_at {:type "string" :format "date-time"}}}
      
      :NewSubmission
      {:type "object"
       :required [:title :category :difficulty :objective :mission_description :why_description :pilot_experience :submitter_name]
       :properties {:title {:type "string"}
                   :category {:type "string"}
                   :difficulty {:type "integer" :minimum 1 :maximum 10}
                   :objective {:type "string"}
                   :mission_description {:type "string"}
                   :why_description {:type "string"}
                   :notes {:type "string"}
                   :route {:type "string"}
                   :pilot_experience {:type "string" :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"]}
                   :submitter_name {:type "string"}
                   :submitter_email {:type "string"}}}
      
      :ImportMission
      {:type "object"
       :required [:title :category :difficulty :objective :mission_description :why_description]
       :properties {:title {:type "string"}
                   :category {:type "string"}
                   :difficulty {:type "integer" :minimum 1 :maximum 10}
                   :objective {:type "string"}
                   :mission_description {:type "string"}
                   :why_description {:type "string"}
                   :notes {:type "string"}
                   :route {:type "string"}
                   :suggested_route {:type "string"}
                   :pilot_experience {:type "string" :enum ["Beginner (< 100 hours)" "Intermediate (100 - 1000 hours)" "Advanced (1000+ hours)"] :default "Beginner (< 100 hours)"}
}}}
     
     :securityDefinitions
     {:BearerAuth
      {:type "apiKey"
       :name "Authorization"
       :in "header"
       :description "JWT token for admin authentication. Format: Bearer <token>"}}}))
