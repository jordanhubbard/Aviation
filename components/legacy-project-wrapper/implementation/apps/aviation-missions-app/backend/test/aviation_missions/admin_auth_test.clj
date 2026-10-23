(ns aviation-missions.admin-auth-test
  (:require [clojure.test :refer :all]
            [aviation-missions.admin-auth :as admin-auth]
            [cheshire.core :as json]
            [clojure.java.io :as io]))

(def test-admins-file "/tmp/test-admins-aviation.json")

(defn setup-test-file []
  "Create a test admins.json file for testing"
  (spit test-admins-file 
        (json/generate-string 
          {:admins [{:name "Test Admin"
                    :email "test@example.com"
                    :password_hash nil
                    :first_login true
                    :created_at "2025-01-01T00:00:00Z"}
                   {:name "Active Admin"
                    :email "active@example.com"
                    :password_hash (admin-auth/hash-password "password123")
                    :first_login false
                    :created_at "2025-01-01T00:00:00Z"}]}
          {:pretty true})))

(defn teardown-test-file []
  "Clean up test file"
  (io/delete-file test-admins-file true))

(use-fixtures :each
  (fn [test-fn]
    (setup-test-file)
    (with-redefs [admin-auth/admins-file-path test-admins-file]
      (test-fn))
    (teardown-test-file)))

;; ===== Password Hashing Tests =====

(deftest test-password-hashing
  (testing "bcrypt password hashing"
    (let [password "testpass123"
          hash (admin-auth/hash-password password)]
      (is (not= password hash) "Password should not equal hash")
      (is (string? hash) "Hash should be a string")
      (is (> (count hash) 50) "Bcrypt hash should be long"))))

(deftest test-password-verification
  (testing "password verification with correct password"
    (let [password "correctpassword"
          hash (admin-auth/hash-password password)]
      (is (admin-auth/verify-password password hash) "Correct password should verify")))
  
  (testing "password verification with wrong password"
    (let [password "correctpassword"
          wrong-password "wrongpassword"
          hash (admin-auth/hash-password password)]
      (is (not (admin-auth/verify-password wrong-password hash)) "Wrong password should not verify")))
  
  (testing "password verification with nil"
    (is (not (admin-auth/verify-password nil "somehash")) "Nil password should not verify")
    (is (not (admin-auth/verify-password "password" nil)) "Nil hash should not verify")))

;; ===== Admin File Operations Tests =====

(deftest test-read-admins
  (testing "read admins from file"
    (let [admins (admin-auth/read-admins)]
      (is (vector? admins) "Should return a vector")
      (is (= 2 (count admins)) "Should have 2 admins")
      (is (every? #(contains? % :email) admins) "All admins should have email"))))

(deftest test-write-admins
  (testing "write admins to file"
    (let [new-admins [{:name "New Admin"
                      :email "new@example.com"
                      :password_hash nil
                      :first_login true
                      :created_at "2025-01-01T00:00:00Z"}]]
      (admin-auth/write-admins! new-admins)
      (let [read-back (admin-auth/read-admins)]
        (is (= 1 (count read-back)) "Should have 1 admin after write")
        (is (= "New Admin" (:name (first read-back))) "Should have correct name")))))

;; ===== Admin Lookup Tests =====

(deftest test-find-admin-by-email
  (testing "find existing admin by email"
    (let [admin (admin-auth/find-admin-by-email "test@example.com")]
      (is (some? admin) "Should find admin")
      (is (= "Test Admin" (:name admin)) "Should have correct name")
      (is (= true (:first_login admin)) "Should have first_login flag")))
  
  (testing "find admin with case-insensitive email"
    (let [admin (admin-auth/find-admin-by-email "TEST@EXAMPLE.COM")]
      (is (some? admin) "Should find admin with uppercase email")
      (is (= "Test Admin" (:name admin)) "Should match admin")))
  
  (testing "find non-existent admin"
    (let [admin (admin-auth/find-admin-by-email "nonexistent@example.com")]
      (is (nil? admin) "Should return nil for non-existent admin")))
  
  (testing "find admin with nil email"
    (let [admin (admin-auth/find-admin-by-email nil)]
      (is (nil? admin) "Should return nil for nil email"))))

(deftest test-admin-exists
  (testing "admin exists returns true for existing admin"
    (is (admin-auth/admin-exists? "test@example.com") "Should return true"))
  
  (testing "admin exists returns false for non-existent admin"
    (is (not (admin-auth/admin-exists? "nonexistent@example.com")) "Should return false"))
  
  (testing "admin exists is case-insensitive"
    (is (admin-auth/admin-exists? "TEST@EXAMPLE.COM") "Should return true for uppercase")))

;; ===== Authentication Tests =====

(deftest test-authenticate-admin-first-login
  (testing "authenticate admin on first login"
    (let [result (admin-auth/authenticate-admin "test@example.com" "anypassword")]
      (is (some? result) "Should return result")
      (is (= true (:first_login result)) "Should indicate first login")
      (is (= "test@example.com" (:email result)) "Should have email")
      (is (= "Test Admin" (:name result)) "Should have name"))))

(deftest test-authenticate-admin-regular-login
  (testing "authenticate admin with correct password"
    (let [result (admin-auth/authenticate-admin "active@example.com" "password123")]
      (is (some? result) "Should return result")
      (is (= false (:first_login result)) "Should not be first login")
      (is (= "active@example.com" (:email result)) "Should have email")))
  
  (testing "authenticate admin with wrong password"
    (let [result (admin-auth/authenticate-admin "active@example.com" "wrongpassword")]
      (is (nil? result) "Should return nil for wrong password")))
  
  (testing "authenticate non-existent admin"
    (let [result (admin-auth/authenticate-admin "nonexistent@example.com" "password")]
      (is (nil? result) "Should return nil for non-existent admin"))))

;; ===== Password Setup Tests =====

(deftest test-set-admin-password
  (testing "set password for first-time admin"
    (admin-auth/set-admin-password! "test@example.com" "newpassword123")
    (let [admin (admin-auth/find-admin-by-email "test@example.com")]
      (is (some? (:password_hash admin)) "Should have password hash")
      (is (= false (:first_login admin)) "Should not be first login anymore")
      (is (admin-auth/verify-password "newpassword123" (:password_hash admin)) 
          "Password should verify")))
  
  (testing "authenticate after setting password"
    (admin-auth/set-admin-password! "test@example.com" "newpassword456")
    (let [result (admin-auth/authenticate-admin "test@example.com" "newpassword456")]
      (is (some? result) "Should authenticate with new password")
      (is (= false (:first_login result)) "Should not be first login"))))

;; ===== Admin CRUD Tests =====

(deftest test-create-admin
  (testing "create new admin"
    (let [new-admin (admin-auth/create-admin! "New User" "newuser@example.com")]
      (is (some? new-admin) "Should return new admin")
      (is (= "New User" (:name new-admin)) "Should have correct name")
      (is (= "newuser@example.com" (:email new-admin)) "Should have correct email")
      (is (= true (:first_login new-admin)) "Should be first login")
      (is (nil? (:password_hash new-admin)) "Should not have password")))
  
  (testing "create duplicate admin returns nil"
    (let [duplicate (admin-auth/create-admin! "Duplicate" "test@example.com")]
      (is (nil? duplicate) "Should return nil for duplicate email")))
  
  (testing "created admin can be found"
    (admin-auth/create-admin! "Findable" "findable@example.com")
    (is (admin-auth/admin-exists? "findable@example.com") "Should be able to find created admin")))

(deftest test-delete-existing-admin
  (testing "delete existing admin"
    (admin-auth/delete-admin! "test@example.com")
    (is (not (admin-auth/admin-exists? "test@example.com")) "Admin should be deleted")))

(deftest test-delete-nonexistent-admin
  (testing "delete non-existent admin does not error"
    (is (nil? (admin-auth/delete-admin! "nonexistent@example.com"))
        "Should not error on non-existent admin")))

(deftest test-admins-count-decrements-after-deletion
  (testing "admins list after deletion"
    (let [initial-count (count (admin-auth/read-admins))]
      (admin-auth/delete-admin! "test@example.com")
      (is (= (dec initial-count) (count (admin-auth/read-admins)))
          "Should have one less admin"))))

(deftest test-list-admins
  (testing "list all admins"
    (let [admins (admin-auth/list-admins)]
      (is (= 2 (count admins)) "Should have 2 admins")
      (is (every? #(not (contains? % :password_hash)) admins) 
          "Should not include password hashes")))
  
  (testing "list admins after creating new one"
    (admin-auth/create-admin! "Third Admin" "third@example.com")
    (is (= 3 (count (admin-auth/list-admins))) "Should have 3 admins")))

(deftest test-count-admins
  (testing "count admins"
    (is (= 2 (admin-auth/count-admins)) "Should count 2 admins")))

(deftest test-count-admins-after-adding-admin
  (testing "count after adding admin"
    (admin-auth/create-admin! "Fourth" "fourth@example.com")
    (is (= 3 (admin-auth/count-admins)) "Should count 3 admins")))

(deftest test-count-admins-after-deleting-admin
  (testing "count after deleting admin"
    (admin-auth/delete-admin! "test@example.com")
    (is (= 1 (admin-auth/count-admins)) "Should count 1 admin")))

;; ===== Edge Cases and Security Tests =====

(deftest test-email-case-sensitivity
  (testing "email operations are case-insensitive"
    (is (admin-auth/admin-exists? "TEST@EXAMPLE.COM") "Uppercase email should find admin")
    (is (admin-auth/admin-exists? "TesT@ExAmPlE.CoM") "Mixed case email should find admin")
    (let [admin (admin-auth/find-admin-by-email "ACTIVE@EXAMPLE.COM")]
      (is (some? admin) "Should find admin with uppercase email")
      (is (= "active@example.com" (:email admin)) "Should return original case"))))

(deftest test-password-requirements
  (testing "bcrypt produces different hashes for same password"
    (let [password "samepassword"
          hash1 (admin-auth/hash-password password)
          hash2 (admin-auth/hash-password password)]
      (is (not= hash1 hash2) "Same password should produce different hashes (salt)")
      (is (admin-auth/verify-password password hash1) "Both hashes should verify")
      (is (admin-auth/verify-password password hash2) "Both hashes should verify"))))

(deftest test-file-not-found
  (testing "gracefully handle missing admins file"
    (teardown-test-file)
    (let [admins (admin-auth/read-admins)]
      (is (vector? admins) "Should return vector even if file missing"))))

(deftest test-concurrent-operations
  (testing "multiple read operations work concurrently"
    (let [results (doall (pmap (fn [_] (admin-auth/read-admins)) (range 10)))]
      (is (= 10 (count results)) "Should complete all reads")
      (is (every? #(= 2 (count %)) results) "All reads should return same data"))))

;; ===== Integration Tests =====

(deftest test-full-admin-lifecycle
  (testing "complete admin lifecycle"
    ; Create new admin
    (let [new-admin (admin-auth/create-admin! "Lifecycle Test" "lifecycle@example.com")]
      (is (some? new-admin) "Should create admin"))
    
    ; Verify first login
    (let [auth-result (admin-auth/authenticate-admin "lifecycle@example.com" "anypassword")]
      (is (:first_login auth-result) "Should be first login"))
    
    ; Set password
    (admin-auth/set-admin-password! "lifecycle@example.com" "mypassword")
    
    ; Verify regular login
    (let [auth-result (admin-auth/authenticate-admin "lifecycle@example.com" "mypassword")]
      (is (not (:first_login auth-result)) "Should not be first login"))
    
    ; Verify wrong password fails
    (let [auth-result (admin-auth/authenticate-admin "lifecycle@example.com" "wrongpassword")]
      (is (nil? auth-result) "Wrong password should fail"))
    
    ; Delete admin
    (admin-auth/delete-admin! "lifecycle@example.com")
    (is (not (admin-auth/admin-exists? "lifecycle@example.com")) "Should be deleted")))

(deftest test-multiple-admin-management
  (testing "manage multiple admins"
    ; Start with 2 admins
    (is (= 2 (admin-auth/count-admins)) "Should start with 2 admins")
    
    ; Add 3 more
    (admin-auth/create-admin! "Admin 3" "admin3@example.com")
    (admin-auth/create-admin! "Admin 4" "admin4@example.com")
    (admin-auth/create-admin! "Admin 5" "admin5@example.com")
    (is (= 5 (admin-auth/count-admins)) "Should have 5 admins")
    
    ; Delete 2
    (admin-auth/delete-admin! "admin3@example.com")
    (admin-auth/delete-admin! "admin4@example.com")
    (is (= 3 (admin-auth/count-admins)) "Should have 3 admins left")
    
    ; Verify remaining admins
    (is (admin-auth/admin-exists? "test@example.com") "Original admin should exist")
    (is (admin-auth/admin-exists? "active@example.com") "Original admin should exist")
    (is (admin-auth/admin-exists? "admin5@example.com") "New admin should exist")
    (is (not (admin-auth/admin-exists? "admin3@example.com")) "Deleted admin should not exist")))

;; ===== Test Summary =====

(deftest test-admin-auth-module-loaded
  (testing "admin-auth module loaded successfully"
    (is (resolve 'aviation-missions.admin-auth/hash-password) "hash-password function exists")
    (is (resolve 'aviation-missions.admin-auth/verify-password) "verify-password function exists")
    (is (resolve 'aviation-missions.admin-auth/authenticate-admin) "authenticate-admin function exists")
    (is (resolve 'aviation-missions.admin-auth/create-admin!) "create-admin! function exists")
    (is (resolve 'aviation-missions.admin-auth/delete-admin!) "delete-admin! function exists")))
