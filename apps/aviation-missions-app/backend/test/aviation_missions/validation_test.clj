(ns aviation-missions.validation-test
  (:require [clojure.test :refer :all]
            [clojure.spec.alpha :as s]
            [aviation-missions.handlers :as handlers]
            [aviation-missions.db :as db]
            [clojure.string :as str]))

;; Test the validation specs directly
(deftest test-validation-specs
  (testing "Valid mission data passes spec validation"
    (let [valid-mission {:title "Valid Mission"
                        :category "Training"
                        :difficulty 5
                        :objective "Valid objective"
                        :mission_description "Valid description"
                        :why_description "Valid why description"
                        :notes "Optional notes"
                        :route "KPAO-KSQL"
                        :pilot_experience "Intermediate (100-500 hours)"}]

      (is (s/valid? ::handlers/mission-data valid-mission))
      (is (nil? (s/explain-data ::handlers/mission-data valid-mission)))))

  (testing "Mission with missing required fields fails validation"
    (let [invalid-mission {:title "Invalid Mission"
                          :category "Training"
                          ;; Missing difficulty, objective, mission_description, why_description
                          }]

      (is (not (s/valid? ::handlers/mission-data invalid-mission)))
      (is (some? (s/explain-data ::handlers/mission-data invalid-mission)))))

  (testing "Empty string validation"
    (is (not (s/valid? ::handlers/non-empty-string "")))
    (is (not (s/valid? ::handlers/non-empty-string "   ")))
    (is (not (s/valid? ::handlers/non-empty-string nil)))
    (is (s/valid? ::handlers/non-empty-string "valid")))

  (testing "Title validation"
    (is (s/valid? ::handlers/title "Valid Title"))
    (is (not (s/valid? ::handlers/title "")))
    (is (not (s/valid? ::handlers/title nil)))
    (is (not (s/valid? ::handlers/title 123))))

  (testing "Category validation"
    (is (s/valid? ::handlers/category "Training"))
    (is (s/valid? ::handlers/category "Proficiency"))
    (is (s/valid? ::handlers/category "Cross-Country"))
    (is (s/valid? ::handlers/category "Emergency"))
    (is (not (s/valid? ::handlers/category "InvalidCategory")))
    (is (not (s/valid? ::handlers/category "")))
    (is (not (s/valid? ::handlers/category nil))))

  (testing "Difficulty validation"
    (is (s/valid? ::handlers/difficulty 1))
    (is (s/valid? ::handlers/difficulty 5))
    (is (s/valid? ::handlers/difficulty 10))
    (is (not (s/valid? ::handlers/difficulty 0)))
    (is (not (s/valid? ::handlers/difficulty 11)))
    (is (not (s/valid? ::handlers/difficulty -1)))
    (is (not (s/valid? ::handlers/difficulty "5")))
    (is (not (s/valid? ::handlers/difficulty nil))))

  (testing "Optional field validation"
    (is (s/valid? ::handlers/notes nil))
    (is (s/valid? ::handlers/notes "Some notes"))
    (is (s/valid? ::handlers/notes ""))
    (is (not (s/valid? ::handlers/notes 123)))

    (is (s/valid? ::handlers/route nil))
    (is (s/valid? ::handlers/route "KPAO-KSQL"))
    (is (s/valid? ::handlers/route ""))

    (is (s/valid? ::handlers/pilot_experience nil))
    (is (s/valid? ::handlers/pilot_experience "Beginner (< 100 hours)"))))

;; Test edge cases and boundary conditions
(deftest test-validation-edge-cases
  (testing "String length boundaries"
    ;; Very long title (near database limit)
    (let [long-title (apply str (repeat 255 "A"))]
      (is (s/valid? ::handlers/title long-title)))

    ;; Title exceeding reasonable length (should still validate by spec but may fail at DB)
    (let [very-long-title (apply str (repeat 1000 "A"))]
      (is (s/valid? ::handlers/title very-long-title))))

  (testing "Special characters in strings"
    (let [special-chars-mission {:title "Mission with émojis 🛩️ and spëcial chars"
                                :category "Training"
                                :difficulty 5
                                :objective "Test special chars: < > & \" '"
                                :mission_description "Description with newlines\nand\ttabs"
                                :why_description "Unicode: αβγ δεζ"}]

      (is (s/valid? ::handlers/mission-data special-chars-mission))))

  (testing "Whitespace handling"
    ;; Whitespace-only strings should be invalid for required fields
    (let [whitespace-mission {:title "   \t\n   "
                             :category "Training"
                             :difficulty 5
                             :objective "   "
                             :mission_description "Valid description"
                             :why_description "Valid why"}]

      (is (not (s/valid? ::handlers/mission-data whitespace-mission)))))

  (testing "Numeric edge cases"
    (is (not (s/valid? ::handlers/difficulty Integer/MIN_VALUE)))  ; Should fail range check
    (is (not (s/valid? ::handlers/difficulty Integer/MAX_VALUE)))  ; Should fail range check
    (is (not (s/valid? ::handlers/difficulty 0)))
    (is (not (s/valid? ::handlers/difficulty 11)))))

;; Test validation with various data types
(deftest test-type-validation
  (testing "Invalid data types"
    ;; Title as number
    (let [mission-with-numeric-title {:title 123
                                     :category "Training"
                                     :difficulty 5
                                     :objective "Valid"
                                     :mission_description "Valid"
                                     :why_description "Valid"}]
      (is (not (s/valid? ::handlers/mission-data mission-with-numeric-title))))

    ;; Difficulty as string
    (let [mission-with-string-difficulty {:title "Valid Title"
                                         :category "Training"
                                         :difficulty "5"
                                         :objective "Valid"
                                         :mission_description "Valid"
                                         :why_description "Valid"}]
      (is (not (s/valid? ::handlers/mission-data mission-with-string-difficulty))))

    ;; Category as number
    (let [mission-with-numeric-category {:title "Valid Title"
                                        :category 1
                                        :difficulty 5
                                        :objective "Valid"
                                        :mission_description "Valid"
                                        :why_description "Valid"}]
      (is (not (s/valid? ::handlers/mission-data mission-with-numeric-category)))))

  (testing "Nested data structures (should be invalid)"
    (let [mission-with-nested-data {:title "Valid Title"
                                   :category "Training"
                                   :difficulty 5
                                   :objective {:nested "object"}
                                   :mission_description "Valid"
                                   :why_description "Valid"}]
      (is (not (s/valid? ::handlers/mission-data mission-with-nested-data))))))

;; Test real-world validation scenarios
(deftest test-real-world-validation-scenarios
  (testing "Mission created from form with empty optional fields"
    (let [form-mission {:title "Form Mission"
                       :category "Training"
                       :difficulty 5
                       :objective "Form objective"
                       :mission_description "Form description"
                       :why_description "Form why"
                       :notes ""
                       :route ""
                       :pilot_experience ""}]

      (is (s/valid? ::handlers/mission-data form-mission))))

  (testing "Mission with realistic aviation content"
    (let [aviation-mission {:title "VFR Pattern Work at Class D Airport"
                           :category "Training"
                           :difficulty 3
                           :objective "Practice standard traffic patterns and radio communications"
                           :mission_description "Perform 3-5 touch-and-go landings at KRHV (Reid-Hillview) during daylight hours with active tower"
                           :why_description "Builds confidence in controlled airspace, improves radio skills, and develops consistent approach technique"
                           :notes "Monitor ATIS before arrival. Use standard phraseology. Be aware of helicopter traffic."
                           :route "KPAO departure, direct KRHV via Calaveras Reservoir"
                           :pilot_experience "Beginner (< 100 hours)"}]

      (is (s/valid? ::handlers/mission-data aviation-mission))))

  (testing "Mission with international characters"
    (let [international-mission {:title "Flug nach München"
                                :category "Cross-Country"
                                :difficulty 7
                                :objective "Navigate to international airport using GPS and radio navigation"
                                :mission_description "Plan and execute cross-country flight to München (EDDM)"
                                :why_description "Experience international flight planning and procedures"
                                :notes "Ensure proper documentation and customs procedures"
                                :route "Direct via airways"
                                :pilot_experience "Advanced (500+ hours)"}]

      (is (s/valid? ::handlers/mission-data international-mission)))))

;; Test validation helper functions
(deftest test-validation-helper-functions
  (testing "validate-mission-data function"
    ;; Test with valid data
    (let [valid-mission {:title "Valid Mission"
                        :category "Training"
                        :difficulty 5
                        :objective "Valid objective"
                        :mission_description "Valid description"
                        :why_description "Valid why"}]
      (is (nil? (#'handlers/validate-mission-data valid-mission))))

    ;; Test with invalid data
    (let [invalid-mission {:title "Invalid Mission"
                          :category "InvalidCategory"
                          :difficulty 15
                          :objective ""
                          :mission_description "Valid description"
                          :why_description "Valid why"}
          validation-error (#'handlers/validate-mission-data invalid-mission)]

      (is (string? validation-error))
      (is (> (count validation-error) 0)))))

;; Test validation in context of API calls
(deftest test-api-validation-integration
  ;; These tests verify that validation is properly integrated into the API handlers

  (testing "Handler validates mission data before database operations"
    ;; This would require mocking or testing the actual handler functions
    ;; For now, we'll test that the validation functions work correctly

    (let [valid-data {:title "Handler Test"
                     :category "Training"
                     :difficulty 5
                     :objective "Test handler validation"
                     :mission_description "Test description"
                     :why_description "Test why"}
          invalid-data {:title ""
                       :category "InvalidCategory"
                       :difficulty 0
                       :objective "Test"
                       :mission_description "Test"
                       :why_description "Test"}]

      ;; Valid data should pass validation
      (is (nil? (#'handlers/validate-mission-data valid-data)))

      ;; Invalid data should fail validation
      (is (string? (#'handlers/validate-mission-data invalid-data))))))

;; Test validation performance
(deftest test-validation-performance
  (testing "Validation performance with large datasets"
    (let [large-mission {:title (apply str (repeat 200 "A"))
                        :category "Training"
                        :difficulty 5
                        :objective (apply str (repeat 500 "Objective "))
                        :mission_description (apply str (repeat 2000 "Description "))
                        :why_description (apply str (repeat 1000 "Why "))
                        :notes (apply str (repeat 1000 "Notes "))
                        :route (apply str (repeat 400 "Route "))
                        :pilot_experience "Intermediate (100-500 hours)"}

          start-time (System/nanoTime)]

      ;; Validate 1000 times
      (dotimes [_ 1000]
        (s/valid? ::handlers/mission-data large-mission))

      (let [end-time (System/nanoTime)
            duration-ms (/ (- end-time start-time) 1000000)]

        ;; Should complete within reasonable time
        (is (< duration-ms 1000) "1000 validations should complete within 1 second")))))

;; Test validation with malformed data structures
(deftest test-malformed-data-validation
  (testing "Validation with completely wrong data structure"
    ;; Array instead of map
    (is (not (s/valid? ::handlers/mission-data [])))

    ;; String instead of map
    (is (not (s/valid? ::handlers/mission-data "not a mission")))

    ;; Number instead of map
    (is (not (s/valid? ::handlers/mission-data 123)))

    ;; Nil
    (is (not (s/valid? ::handlers/mission-data nil))))

  (testing "Validation with extra fields"
    (let [mission-with-extra-fields {:title "Extra Fields Mission"
                                    :category "Training"
                                    :difficulty 5
                                    :objective "Test extra fields"
                                    :mission_description "Test description"
                                    :why_description "Test why"
                                    :extra_field "This should not be here"
                                    :another_extra 123}]

      ;; Should still validate (spec allows extra keys by default)
      (is (s/valid? ::handlers/mission-data mission-with-extra-fields)))))

;; Test validation error messages
(deftest test-validation-error-messages
  (testing "Validation error messages are informative"
    (let [invalid-mission {:title ""
                          :category "Invalid"
                          :difficulty 20
                          :objective ""
                          :mission_description ""
                          :why_description ""}
          error-message (#'handlers/validate-mission-data invalid-mission)]

      (is (string? error-message))
      (is (> (count error-message) 50)) ; Should be reasonably detailed

      ;; Should mention specific fields that failed
      (is (or (.contains error-message "title")
              (.contains error-message ":title")))
      (is (or (.contains error-message "category")
              (.contains error-message ":category")))
      (is (or (.contains error-message "difficulty")
              (.contains error-message ":difficulty"))))))

;; Test that validation covers all required business rules
(deftest test-business-rule-validation
  (testing "Aviation-specific validation rules"
    ;; These tests would be extended based on specific business requirements

    (testing "Difficulty levels are reasonable for aviation training"
      (is (s/valid? ::handlers/difficulty 1))   ; Basic pattern work
      (is (s/valid? ::handlers/difficulty 5))   ; Cross-country
      (is (s/valid? ::handlers/difficulty 10))  ; Emergency procedures
      (is (not (s/valid? ::handlers/difficulty 0)))   ; No such thing as 0 difficulty
      (is (not (s/valid? ::handlers/difficulty 11))))  ; Max is 10

    (testing "Categories match aviation training types"
      (is (s/valid? ::handlers/category "Training"))
      (is (s/valid? ::handlers/category "Proficiency"))
      (is (s/valid? ::handlers/category "Cross-Country"))
      (is (s/valid? ::handlers/category "Emergency"))
      (is (not (s/valid? ::handlers/category "Driving")))  ; Not aviation-related
      (is (not (s/valid? ::handlers/category "Swimming")))) ; Not aviation-related

    ;; Additional aviation-specific rules could be added here
    ;; e.g., airport code validation, route format validation, etc.
    ))