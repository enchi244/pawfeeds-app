#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include <Firebase_ESP_Client.h>
#include <ESP32Servo.h>
#include <time.h>
#include <HX711.h>

// ========== USER CONFIGURATION ==========
// PASTE YOUR SERVICE ACCOUNT CREDENTIALS FROM THE DOWNLOADED JSON FILE
#define FIREBASE_PROJECT_ID "pawfeeds-v2"
#define FIREBASE_DATABASE_URL "https://pawfeeds-v2-default-rtdb.asia-southeast1.firebasedatabase.app/" 
#define SERVICE_ACCOUNT_CLIENT_EMAIL "firebase-adminsdk-fbsvc@pawfeeds-v2.iam.gserviceaccount.com"
#define SERVICE_ACCOUNT_PRIVATE_KEY "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC+Sqt8BKfCEgbp\n/q4XmzzpsKwlsKJesbWN/Sp2PO7nVgPqwEz9YeCy/aI98IjyGY5hujaLLNgB0GYE\nNLvWkAf3T6VQPUa8SB28XU5sT7tfCJu/1F3yYYAVHHpbg2gbGxjgPWVlQ5arww57\nHHREzOUTRTO5k9hRAzzf1kdjBJbboewEEcIQH2uAdn+B9L58SOezjVONpr63+R5V\nWbZ7+B64BFE62Xsjcmk49OmHjKc+2ID80S6EWx6rxM5jGdTsUVtA0RISG5r1qeB/\nDazLCx1jexutuMHTogvAIirHGIMdOCW12USD8b+CRvP7Lsj6CwR91JSVm/b5P1pI\n0MNAgkfrAgMBAAECggEAO5iNHlki5P/aVHxjr5b5u8KOF3u7TmbfkmmAW+l3dNIW\nhfXV5uE5izUuE7H6YcApPGgiXvIbcG4BFT4iue7/3698+aVHOv5m+bBLOFa8OuYq\nSSjMh3WLtJDnrTN5bkvNPaVc1RsW3BJJvbrKmyWEdMWOjodEDxMxhHTKhLNSP9Rq\ncTz85kc4/IsXuAD6fmApysrWiVuS+vcIzFGCjqQDozojsd58KW6XFa8PEZ95bUbE\n/Q8ZAigB88un8+87NpLd/usUk2FWHNJz523AJUA4qQE0N8J6E/7+dJbRJ9Ucg6lk\nkO0fRiLO7c7o6/7bW1iy4Yq+ph5N3+vc2pYzVZIkAQKBgQD0AbH86UoJxroGh/id\n849814dnEGugSQ1C2XCPNpQy19WtyfZvMM5yphfxfxxohJwr+KyQBcfBatGo/ipV\n9cIJUOalKa+q9KzxLsSka41cvu4RsnVjWyVqGS4w/BdYFdTvNkuK3cGiK8qYwBaW\ni50PNrcCQ+7gmMCjkPJ6LDOh6wKBgQDHpRYRXk9ipsOw4KHBxn4rph8G6ooUIvzs\nPie0e+A+pz9grNDC7y0a+k8fA4eq/iJPmu+FvuJW4fahCkt98VuW0EJjcqtBNgCB\nYbOKn9H+V4WaQKCHYyhl/QxGio4qm4z34cEVt/kMGwGHlaX39RILc3kEq2RfTSc7\n2FikgZxyAQKBgQCz61wWpN5W/xXEIxaLQUCYSUQqFs2FTthcZoC82P3Fz6hbkQQJ\nUO+pUhdtltCXsNCHC8ISIHD+iYk3FtKYt7HvtJudRXOmluu+m0GcC0IdFRvuKKyu\nKlMYPKD2tatw5AgyqtJg/sr8jVXB9EGzmBajVTD0lqrZKUlCUmq480bPKQKBgQCp\nTo0qaYp1JOur4rQK+uQg7B4/5UL31LwdNJDDdJI1T+xldekMh3z+9euHZ5z0G9TJ\nIaGjEMAt4i8fXvWqdravbSn/4EzvXnaLQmnaU7LoORzqNYhtiF/ILhLs96+c3pFr\n3h2652vjIjvn2bcIUuLcpy6oERlr4Kg3DkAOMoSUAQKBgQCkTg6e4Ndg1d2SySFQ\n4h7YHQZ3larxK/03DFoElNIf/6zgiNL13+9nM3l4K8YAEG1OEcn5JaBdktmGrEWR\nA+zV7Qp/hZSVuOM4sxpGa7q94A5253tvLvegIvzhFYW4WQrVFadI5xZ1HaO2Ad9I\nKzz19+jbd085r+kyTM5X0UVzZA==\n-----END PRIVATE KEY-----\n"

// --- Hardware & Provisioning Definitions (Unchanged) ---
#define SERVO_BOWL_1_PIN 21
#define SERVO_BOWL_2_PIN 22
#define HX711_BOWL_1_DOUT_PIN 27
#define HX711_BOWN_1_SCK_PIN 26
#define SLAVE_1_SERIAL_TX_PIN 17
#define SLAVE_1_SERIAL_RX_PIN 16
#define SLAVE_2_SERIAL_TX_PIN 19
#define SLAVE_2_SERIAL_RX_PIN 18
#define DISPENSE_MS_PER_GRAM 50 // Calibrate this: milliseconds the servo runs to dispense 1 gram of food.
const char* AP_SSID = "PawFeeds_Setup";
const char* AP_PASSWORD = NULL;

// --- Global Objects & State Machine ---
WiFiServer server(80);
Preferences preferences;
FirebaseData stream_fbdo; // Dedicated object for the RTDB stream
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
Servo servoBowl1;
Servo servoBowl2;
HX711 loadCellBowl1;

String feederId = "";
String streamPath = "/commands/";
bool streamActive = false;
unsigned long lastCmdTimestamp = 0;

unsigned long bootTimestamp = 0;
// --- Scheduling Globals ---
struct Schedule {
  String id;
  bool isEnabled;
  int bowlNumber;
  int portionGrams;
  int hour;
  int minute;
  String repeatDays; // Contains "U" (Sun), "M", "T", "W", "R", "F", "S"
};
MB_VECTOR<Schedule> schedules;
unsigned long lastScheduleCheck = 0;
unsigned long lastScheduleFetch = 0;

// --- Command Processing Globals ---
volatile bool newCommandAvailable = false;
struct Command {
  int bowl;
  int amount;
};
Command pendingCommand;

enum DeviceState { PROVISIONING_MODE, CONNECTING_WIFI, AUTHENTICATING_FIREBASE, REGISTERING_FIREBASE, OPERATIONAL, ERROR };
DeviceState currentState = PROVISIONING_MODE;

// --- Function Prototypes ---
void tokenStatusCallback(TokenInfo info);
void connectToWiFi();
void authenticateWithFirebase();
void registerDeviceWithFirestore();
void startProvisioningServer();
void handleClient();
String urlDecode(String str);
String parseFeederIdFromResponse(String response);
void dispenseFood(int bowl, int amount);
void processPendingCommand();
void startRTDBStream();
void fetchSchedules();
void checkSchedules();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);


void setup() {
  bootTimestamp = millis();
  Serial.begin(115200);
  Serial.println("\n[PawFeeds] Booting with Service Account Auth...");
  servoBowl1.attach(SERVO_BOWL_1_PIN);
  servoBowl2.attach(SERVO_BOWL_2_PIN);
  loadCellBowl1.begin(HX711_BOWL_1_DOUT_PIN, HX711_BOWN_1_SCK_PIN);

  preferences.begin("pawfeeds", false);
  if (preferences.getString("ssid", "").length() > 0) {
    currentState = CONNECTING_WIFI;
  } else {
    currentState = PROVISIONING_MODE;
    startProvisioningServer();
  }
}

void loop() {
  switch (currentState) {
    case PROVISIONING_MODE: handleClient(); break;
    case CONNECTING_WIFI: connectToWiFi(); break;
    case AUTHENTICATING_FIREBASE: authenticateWithFirebase(); break;
    case REGISTERING_FIREBASE: registerDeviceWithFirestore(); break;
    case OPERATIONAL:
      if (!streamActive) startRTDBStream();
      checkSchedules();
      // Periodically re-fetch schedules to get any updates from Firestore
      if (millis() - lastScheduleFetch > 3600000) { // 3600000 ms = 1 hour
        lastScheduleFetch = millis();
        fetchSchedules();
      }

      if (Firebase.ready() && !Firebase.RTDB.readStream(&stream_fbdo)) {
        Serial.println("[ERROR] Stream read error!");
        streamActive = false;
      }
      if (newCommandAvailable) {
        processPendingCommand();
        newCommandAvailable = false;
      }
      break;
    case ERROR: 
      Serial.println("[ERROR] Halting.");
      delay(10000); 
      break;
  }
  delay(100);
}

void tokenStatusCallback(TokenInfo info) {
  if (info.status == token_status_ready) {
    Serial.println("[AUTH] Token obtained successfully.");
  } else if (info.status == token_status_error) {
    Serial.printf("[AUTH] Token error: %s\n", info.error.message.c_str());
  }
}

void connectToWiFi() {
  Serial.println("[WIFI] Connecting...");
  WiFi.begin(preferences.getString("ssid").c_str(), preferences.getString("pass").c_str());
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected!");
    currentState = AUTHENTICATING_FIREBASE;
  } else {
    Serial.println("\n[WIFI] Failed!");
    currentState = ERROR;
  }
}

void authenticateWithFirebase() {
  if(Firebase.ready()) {
    Serial.println("[AUTH] Already authenticated.");
    feederId = preferences.getString("feederId", "");
    if(feederId.length() > 0) {
      currentState = OPERATIONAL;
      lastScheduleFetch = millis(); // Set the timer for the first fetch
      fetchSchedules(); // Fetch schedules once authenticated
    } else {
      currentState = REGISTERING_FIREBASE;
    }
    return;
  }
  
  Serial.println("[AUTH] Configuring service account...");

  // Set time zone to allow the library to sync time correctly.
  // This is the proper way to handle NTP issues.
  config.time_zone = 8; // For Asia/Singapore (GMT+8)
  config.daylight_offset = 0; // No daylight saving for this region

  config.database_url = FIREBASE_DATABASE_URL; // Required for RTDB stream
  config.service_account.data.client_email = SERVICE_ACCOUNT_CLIENT_EMAIL;
  config.service_account.data.project_id = FIREBASE_PROJECT_ID;
  config.service_account.data.private_key = SERVICE_ACCOUNT_PRIVATE_KEY;
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void registerDeviceWithFirestore() {
  if (!Firebase.ready()) {
    Serial.println("[FIREBASE] Waiting for auth token...");
    return; // Wait for token
  }

  Serial.println("[FIREBASE] Registering device...");
  String owner_uid = preferences.getString("owner_uid", "");
  if (owner_uid.length() == 0) { currentState = ERROR; return; }

  FirebaseJson content;
  content.set("fields/owner_uid/stringValue", owner_uid);
  content.set("fields/online/booleanValue", true);
  String feederContent;
  content.toString(feederContent, false);

  if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "", "feeders", feederContent.c_str())) {
      Serial.println("[FIREBASE] Feeder document created.");
      feederId = parseFeederIdFromResponse(fbdo.payload());
      if (feederId.length() > 0) {
          preferences.putString("feederId", feederId);
          String usersPath = "users/";
          usersPath.concat(owner_uid);
          
          FirebaseJson userUpdateContent;
          userUpdateContent.set("fields/feederId/stringValue", feederId);
          String userContent;
          userUpdateContent.toString(userContent, false);
          
          if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "", usersPath.c_str(), userContent.c_str(), "feederId")) {
              Serial.println("[FIREBASE] User patched. Setup complete!");
              lastScheduleFetch = millis(); // Set the timer for the first fetch
              fetchSchedules(); // Fetch schedules for the first time
              currentState = OPERATIONAL;
          } else {
              Serial.printf("[ERROR] Failed to patch user: %s\n", fbdo.errorReason().c_str());
              currentState = ERROR;
          }
      } else {
          Serial.println("[ERROR] Failed to parse feeder ID from response.");
          currentState = ERROR;
      }
  } else {
      Serial.printf("[ERROR] Failed to create feeder doc: %s\n", fbdo.errorReason().c_str());
      currentState = ERROR;
  }
}

void startProvisioningServer() {
  Serial.print("[PROVISIONING] Starting Access Point: ");
  Serial.println(AP_SSID);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("[PROVISIONING] AP IP address: ");
  Serial.println(IP.toString());
  server.begin();
  Serial.println("[PROVISIONING] Web server started.");
}

void handleClient() {
  WiFiClient client = server.available();
  if (!client) return;
  String currentLine = "";
  unsigned long timeout = millis();
  String header = "";
  while (client.connected() && millis() - timeout < 2000) {
    if (client.available()) {
      char c = client.read();
      header += c;
      if (c == '\n') {
        if (currentLine.length() == 0) {
          if (header.indexOf("GET /networks") >= 0) {
            int n = WiFi.scanNetworks();
            String json = "[";
            for (int i = 0; i < n; ++i) {
              if (i > 0) json.concat(",");
              json.concat("{\"ssid\":\"");
              json.concat(WiFi.SSID(i));
              json.concat("\",\"rssi\":");
              json.concat(WiFi.RSSI(i));
              json.concat("}");
            }
            json += "]";
            client.println("HTTP/1.1 200 OK");
            client.println("Content-type:application/json");
            client.println("Connection: close");
            client.println();
            client.println(json);
          } else if (header.indexOf("POST /save") >= 0) {
            String body;
            while (client.available()) { body += (char)client.read(); }
            int ssid_start = body.indexOf("ssid=") + 5;
            int ssid_end = body.indexOf("&", ssid_start);
            String ssid = urlDecode(body.substring(ssid_start, ssid_end));
            int pass_start = body.indexOf("pass=") + 5;
            int pass_end = body.indexOf("&", pass_start);
            String pass = urlDecode(body.substring(pass_start, pass_end));
            int uid_start = body.indexOf("uid=") + 4;
            String uid = urlDecode(body.substring(uid_start));
            preferences.putString("ssid", ssid);
            preferences.putString("pass", pass);
            preferences.putString("owner_uid", uid);
            client.println("HTTP/1.1 200 OK\r\nContent-type:text/html\r\n\r\n<h1>Saved! Restarting...</h1>");
            delay(100);
          }
          break;
        } else {
          currentLine = "";
        }
      } else if (c != '\r') {
        currentLine += c;
      }
    }
  }
  client.stop();
  if (header.indexOf("POST /save") >= 0) {
    Serial.println("[PROVISIONING] Credentials saved. Restarting device.");
    ESP.restart();
  }
}

String parseFeederIdFromResponse(String response) {
    FirebaseJson json;
    json.setJsonData(response);
    FirebaseJsonData result;
    if (json.get(result, "name")) {
        String path = result.to<String>();
        int lastSlash = path.lastIndexOf('/');
        if (lastSlash != -1) {
            return path.substring(lastSlash + 1);
        }
    }
    return "";
}

String urlDecode(String str) {
  String decodedString = "";
  char temp[] = "0x00";
  char c;
  for (int i = 0; i < str.length(); i++) {
    c = str.charAt(i);
    if (c == '+') {
      decodedString += ' ';
    } else if (c == '%') {
      i++;
      temp[2] = str.charAt(i);
      i++;
      temp[3] = str.charAt(i);
      decodedString += (char)strtol(temp, NULL, 16);
    } else {
      decodedString += c;
    }
  }
  return decodedString;
}

void fetchSchedules() {
    if (feederId.length() == 0) return;

    schedules.clear();
    Serial.println("[SCHEDULER] Fetching schedules from Firestore...");

    String schedulePath = "feeders/";
    schedulePath.concat(feederId);
    schedulePath.concat("/schedules");

    // Correctly call listDocuments with the required parameters.
    if (Firebase.Firestore.listDocuments(&fbdo, FIREBASE_PROJECT_ID, "", schedulePath.c_str(), 100, "", "", "", false)) {
        FirebaseJson &json = fbdo.to<FirebaseJson>();
        FirebaseJsonData result;
        json.get(result, "documents");
        FirebaseJsonArray arr; // Create a separate array object
        result.get<FirebaseJsonArray>(arr); // Extract the array into it

        for (size_t i = 0; i < arr.size(); i++) {
            arr.get(result, i); // Get the document object at index i
            
            Schedule sched;
            FirebaseJsonData field;
            
            result.get<FirebaseJson>(json); // Load the current document into the json object for parsing
            
            json.get(field, "name");
            String fullPath = field.to<String>();
            sched.id = fullPath.substring(fullPath.lastIndexOf('/') + 1);

            json.get(field, "fields/isEnabled/booleanValue");
            sched.isEnabled = field.to<bool>();

            json.get(field, "fields/bowlNumber/integerValue");
            sched.bowlNumber = atoi(field.to<const char*>());

            json.get(field, "fields/portionGrams/integerValue");
            sched.portionGrams = atoi(field.to<const char*>());

            json.get(field, "fields/time/stringValue");
            String timeStr = field.to<String>();
            sched.hour = timeStr.substring(0, 2).toInt();
            sched.minute = timeStr.substring(3, 5).toInt();

            json.get(field, "fields/repeatDays/arrayValue/values");
            FirebaseJsonArray daysArr; // Create a separate array for the days
            field.get<FirebaseJsonArray>(daysArr); // Extract the days array into it
            String days = "";
            for(size_t j = 0; j < daysArr.size(); j++) {
                daysArr.get(result, j);
                result.get<FirebaseJson>(json); // Load the array element (which is a JSON object)
                json.get(field, "stringValue"); // Get the string value from it
                days += field.to<String>();
            }
            sched.repeatDays = days;

            schedules.push_back(sched);
            Serial.printf("  - Loaded schedule: %s, Time: %02d:%02d, Enabled: %s\n", sched.id.c_str(), sched.hour, sched.minute, sched.isEnabled ? "Yes" : "No");
        }
    } else {
        Serial.printf("[ERROR] Failed to list schedules: %s\n", fbdo.errorReason().c_str());
    }
}

void checkSchedules() {
    // Check schedules only once per minute
    if (millis() - lastScheduleCheck < 60000) return;
    lastScheduleCheck = millis();

    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);

    char dayOfWeek[] = "UMTWRFS"; // Sunday is 0

    for (size_t i = 0; i < schedules.size(); i++) {
        Schedule &sched = schedules[i];
        if (sched.isEnabled && sched.hour == timeinfo->tm_hour && sched.minute == timeinfo->tm_min) {
            if (sched.repeatDays.indexOf(dayOfWeek[timeinfo->tm_wday]) != -1) {
                Serial.printf("[SCHEDULER] Triggering schedule ID: %s\n", sched.id.c_str());
                dispenseFood(sched.bowlNumber, sched.portionGrams);
            }
        }
    }
}

void processPendingCommand() {
    if (pendingCommand.amount > 0 && pendingCommand.bowl > 0) {
        Serial.printf("[COMMAND] Processing command! Bowl: %d, Amount: %d\n", pendingCommand.bowl, pendingCommand.amount);
        dispenseFood(pendingCommand.bowl, pendingCommand.amount);
 
        String fullStreamPath = streamPath;
        fullStreamPath.concat(feederId);
        // Use the general-purpose fbdo object for the delete operation
        if (Firebase.RTDB.deleteNode(&fbdo, fullStreamPath.c_str())) {
            Serial.println("[COMMAND] Command node deleted successfully.");
        } else {
            Serial.printf("[COMMAND] FAILED to delete command node: %s\n", fbdo.errorReason().c_str());
        }
    }
}

void dispenseFood(int bowlNumber, int amount) {
    Serial.printf("[SERVO] Dispensing %d grams from bowl %d.\n", amount, bowlNumber);
    Servo* targetServo = nullptr;
    if (bowlNumber == 1) targetServo = &servoBowl1;
    else if (bowlNumber == 2) targetServo = &servoBowl2;

    if (targetServo != nullptr) {
        // Assumes a continuous rotation servo where:
        // 90 = stop, 0 = rotate one way, 180 = rotate the other way.
        // We'll use 0 to start dispensing.
        long dispenseDuration = amount * DISPENSE_MS_PER_GRAM;
        Serial.printf("[SERVO] Rotating for %ld ms.\n", dispenseDuration);

        targetServo->write(0); // Start dispensing
        delay(dispenseDuration);
        targetServo->write(90); // Stop dispensing
    }
}

void startRTDBStream() {
    if (feederId.length() == 0 || !Firebase.ready()) return;
    String fullStreamPath = streamPath;
    fullStreamPath.concat(feederId);
    Serial.print("[STREAM] Starting stream on path: ");
    Serial.println(fullStreamPath);
    if (!Firebase.RTDB.beginStream(&stream_fbdo, fullStreamPath.c_str())) {
        Serial.printf("[STREAM] Could not begin stream: %s\n", stream_fbdo.errorReason().c_str());
        return;
    }
    Firebase.RTDB.setStreamCallback(&stream_fbdo, streamCallback, streamTimeoutCallback);
    streamActive = true;
    Serial.println("[STREAM] Stream started successfully.");
}

void streamCallback(FirebaseStream data) {
    Serial.printf("[STREAM] Event: %s, Path: %s, Data: %s\n", data.eventType().c_str(), data.dataPath().c_str(), data.payload().c_str());
    if (data.dataType() == "json" && data.dataPath() == "/") {
        FirebaseJson &json = data.to<FirebaseJson>();
        FirebaseJsonData result;
        String command;
        if (json.get(result, "command")) {
            command = result.to<String>();
        }

        if (command == "feed") {
            unsigned long newTimestamp = 0;
            int bowl = 0;
            int amount = 0;
            if (json.get(result, "timestamp")) newTimestamp = result.to<unsigned long>();
            if (json.get(result, "bowl")) bowl = result.to<int>();
            if (json.get(result, "amount")) amount = result.to<int>();
            if (newTimestamp > 0 && newTimestamp > lastCmdTimestamp) {
                lastCmdTimestamp = newTimestamp; // Prevent re-processing the same command
                pendingCommand = {bowl, amount};
                newCommandAvailable = true; // Signal the main loop to process the command
            }
        } else if (command == "refetch_schedules") {
            Serial.println("[SCHEDULER] Refetch signal received. Fetching new schedules...");
            fetchSchedules();
            // Acknowledge the command by clearing the node. This is more robust than deleting.
            String fullStreamPath = streamPath;
            fullStreamPath.concat(feederId);
            // Using the general-purpose fbdo object for this operation.
            Firebase.RTDB.setNull(&fbdo, fullStreamPath.c_str());
        }
    }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("[STREAM] Stream timed out. It will be restarted automatically.");
    streamActive = false;
  }
}