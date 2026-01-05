(defproject aviation-missions "0.1.0-SNAPSHOT"
  :description "Aviation Mission Management Backend"
  :url "https://github.com/aviation/scenario-generator"
  :license {:name "EPL-2.0 OR GPL-2.0-or-later WITH Classpath-exception-2.0"
            :url "https://www.eclipse.org/legal/epl-2.0/"}
  :dependencies [[org.clojure/clojure "1.11.1"]
                 [ring/ring-core "1.11.0"]
                 [ring/ring-jetty-adapter "1.11.0"]
                 [ring/ring-json "0.5.1"]
                 [compojure "1.7.0"]
                 [cheshire "5.12.0"]
                 [com.h2database/h2 "2.2.224"]
                 [org.clojure/java.jdbc "0.7.12"]
                 [honeysql "1.0.461"]
                 [nilenso/honeysql-postgres "0.4.112"]
                 [ring-cors "0.1.13"]
                 [clj-time "0.15.2"]
                 [ring/ring-defaults "0.4.0"]
                 [metosin/ring-swagger "0.26.2"]
                 [metosin/compojure-api "2.0.0-alpha31"]
                 [org.clojure/tools.logging "1.2.4"]
                 [clj-commons/clj-yaml "1.0.29"]
                 [ch.qos.logback/logback-classic "1.4.14"]
                 [buddy/buddy-hashers "1.8.158"]]
  :plugins [[jonase/eastwood "1.4.2"]]
  :main ^:skip-aot aviation-missions.core
  :target-path "target/%s"
  :profiles {:dev {:dependencies [[ring/ring-mock "0.4.0"]]}
             :test {:dependencies [[ring/ring-mock "0.4.0"]]}
             :uberjar {:aot :all
                       :jvm-opts ["-Dclojure.compiler.direct-linking=true"]}}
  :ring {:handler aviation-missions.core/app
         :port 3000})
