#!/bin/bash
# Build the Shelf & Stock APK: copies ../www into the app's assets and runs Gradle.
# usage: ./build.sh            → app/build/outputs/apk/debug/app-debug.apk (+ copy in ../dist)
set -e
cd "$(dirname "$0")"
A=app/src/main/assets/www
rm -rf "$A"; mkdir -p "$A"
cp -r ../www/. "$A/"
rm -f "$A/sw.js"   # not needed inside the APK
export JAVA_HOME="G:/Android/jdk/jdk-21.0.12.1+1"
export GRADLE_USER_HOME="G:/.gradle"
./gradlew --no-daemon -q assembleDebug
mkdir -p ../dist
cp app/build/outputs/apk/debug/app-debug.apk ../dist/ShelfAndStock-1.1.0.apk
ls -l ../dist
