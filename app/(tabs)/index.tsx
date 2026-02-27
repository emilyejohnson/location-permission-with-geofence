import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

// Unique name for the geofence background task
const GEOFENCE_TASK = "GEOFENCE_TASK";

// Maximum radius for the FriendZone geofence (200 meters)
const FRIENDZONE_RADIUS_M = 200;

// Background function that runs when user ENTERS or EXITS the geofence
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  // If there is an error with the background task
  if (error) {
    console.log("Geofence task error:", error);
    return;
  }

  // If no event data exists, stop
  if (!data) return;

  // Get event type and region information
  const { eventType, region } = data;

  // Determine if the event was ENTER or EXIT
  const type =
    eventType === Location.GeofencingEventType.Enter ? "ENTER" : "EXIT";

  // Log the event to the console
  console.log(`[FriendZone] ${type}: ${region.identifier}`);
});

export default function MapScreen() {
  // Stores user's current location
  const [location, setLocation] = useState(null);

  // Stores any error messages
  const [errorMsg, setErrorMsg] = useState(null);

  // Stores the center of the geofence (null = not visible)
  const [geofenceCenter, setGeofenceCenter] = useState(null);

  // Tracks whether geofencing is active
  const [geofencingActive, setGeofencingActive] = useState(false);

  // Reference to control the map camera
  const mapRef = useRef(null);

  // Runs once when component loads
  useEffect(() => {
    let watchSub;

    (async () => {
      // Request foreground location permission
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      // Request background location permission (needed for geofencing)
      await Location.requestBackgroundPermissionsAsync();

      // Get the user's current location
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(current);

      // Watch for location updates (updates every 3 seconds or 10 meters)
      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        (loc) => setLocation(loc)
      );
    })();

    // Cleanup: stop watching location when component unmounts
    return () => {
      if (watchSub) watchSub.remove();
    };
  }, []);

  // Function runs when FriendZone button is pressed
  const createFriendZone = async () => {
    // If location is not ready yet, stop
    if (!location) return;

    // Set geofence center to current user location
    const center = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    try {
      // Check if geofencing is already running
      const already = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);

      // Stop previous geofence if it exists
      if (already) await Location.stopGeofencingAsync(GEOFENCE_TASK);

      // Start new geofence centered on user
      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: "FriendZone",
          latitude: center.latitude,
          longitude: center.longitude,
          radius: FRIENDZONE_RADIUS_M,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      // After successful start, show the circle
      setGeofenceCenter(center);
      setGeofencingActive(true);

      // Zoom the map to show the geofence clearly
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          600
        );
      }
    } catch (e) {
      console.log("FriendZone error:", e);
      Alert.alert("Could not create FriendZone", String(e?.message ?? e));
    }
  };

  return (
    <View style={styles.container}>
      {/* If location exists, show the map */}
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="satellite"
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Marker at user's current position */}
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You"
          />

          {/* Only show geofence circle if button was pressed */}
          {geofenceCenter && (
            <Circle
              center={geofenceCenter}
              radius={FRIENDZONE_RADIUS_M}
              strokeWidth={2}
            />
          )}
        </MapView>
      ) : (
        // If location is not ready, show message
        <View style={styles.loading}>
          <Text>{errorMsg || "Waiting for location..."}</Text>
        </View>
      )}

      {/* Centered FriendZone button */}
      <Pressable
        style={[
          styles.friendZoneButton,
          geofencingActive && styles.friendZoneButtonActive,
        ]}
        onPress={createFriendZone}
      >
        <Text style={styles.friendZoneText}>
          {geofencingActive ? "FriendZone Active" : "FriendZone"}
        </Text>
      </Pressable>
    </View>
  );
}

// Styles for layout and button
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },

  friendZoneButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -100 }, { translateY: -25 }],
    width: 200,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "blue",
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
  },

  friendZoneButtonActive: {
    borderColor: "green",
  },

  friendZoneText: {
    fontWeight: "800",
    fontSize: 16,
  },
});