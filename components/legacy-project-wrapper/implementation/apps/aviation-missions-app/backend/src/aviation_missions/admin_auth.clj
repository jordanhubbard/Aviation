(ns aviation-missions.admin-auth
  (:require [cheshire.core :as json]
            [buddy.hashers :as hashers]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.tools.logging :as log]))

(def admins-file-path (or (System/getenv "ADMINS_FILE") "./data/admins.json"))

(defn- ensure-admins-file-exists!
  "Ensure the admins.json file exists, create with default admin if not"
  []
  (let [file (io/file admins-file-path)]
    (when-not (.exists file)
      (log/info "Creating default admins.json file")
      (.mkdirs (.getParentFile file))
      (spit admins-file-path 
            (json/generate-string 
              {:admins [{:name "Default Admin"
                        :email "admin@aviation-missions.app"
                        :password_hash nil
                        :first_login true
                        :created_at (str (java.time.Instant/now))}]}
              {:pretty true})))))

(defn read-admins
  "Read all admins from the JSON file"
  []
  (ensure-admins-file-exists!)
  (try
    (let [content (slurp admins-file-path)
          data (json/parse-string content true)]
      (:admins data))
    (catch Exception e
      (log/error e "Failed to read admins file")
      [])))

(defn write-admins!
  "Write admins list to the JSON file"
  [admins]
  (try
    (spit admins-file-path 
          (json/generate-string {:admins admins} {:pretty true}))
    true
    (catch Exception e
      (log/error e "Failed to write admins file")
      false)))

(defn find-admin-by-email
  "Find an admin by email address"
  [email]
  (when email
    (let [admins (read-admins)
          normalized-email (str/lower-case email)]
      (first (filter #(= (str/lower-case (:email %)) normalized-email) admins)))))

(defn admin-exists?
  "Check if an admin with the given email exists"
  [email]
  (some? (find-admin-by-email email)))

(defn verify-password
  "Verify a password against a stored hash"
  [password hash]
  (when (and password hash)
    (hashers/check password hash)))

(defn hash-password
  "Hash a password using bcrypt"
  [password]
  (hashers/derive password))

(defn authenticate-admin
  "Authenticate an admin by email and password. Returns admin info (without password) if successful, nil otherwise"
  [email password]
  (when-let [admin (find-admin-by-email email)]
    (if (:first_login admin)
      ;; First login - no password check needed
      {:email (:email admin)
       :name (:name admin)
       :first_login true}
      ;; Regular login - verify password
      (when (and (:password_hash admin)
                 (verify-password password (:password_hash admin)))
        {:email (:email admin)
         :name (:name admin)
         :first_login false}))))

(defn set-admin-password!
  "Set password for an admin (used for first-time setup)"
  [email password]
  (let [admins (read-admins)
        updated-admins (mapv (fn [admin]
                              (if (= (clojure.string/lower-case (:email admin))
                                     (clojure.string/lower-case email))
                                (assoc admin
                                       :password_hash (hash-password password)
                                       :first_login false)
                                admin))
                            admins)]
    (write-admins! updated-admins)))

(defn create-admin!
  "Create a new admin user (without password - will be set on first login)"
  [name email]
  (when-not (admin-exists? email)
    (let [admins (read-admins)
          new-admin {:name name
                    :email email
                    :password_hash nil
                    :first_login true
                    :created_at (str (java.time.Instant/now))}
          updated-admins (conj (vec admins) new-admin)]
      (write-admins! updated-admins)
      new-admin)))

(defn delete-admin!
  "Delete an admin by email"
  [email]
  (let [admins (read-admins)
        updated-admins (vec (remove #(= (clojure.string/lower-case (:email %))
                                       (clojure.string/lower-case email))
                                   admins))]
    (write-admins! updated-admins)
    nil))

(defn list-admins
  "List all admins (without password hashes)"
  []
  (mapv #(dissoc % :password_hash) (read-admins)))

(defn count-admins
  "Count total number of admins"
  []
  (count (read-admins)))
