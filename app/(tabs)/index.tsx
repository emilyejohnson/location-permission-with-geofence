import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const GEOFENCE_TASK = "GEOFENCE_TASK";
const FRIENDZONE_RADIUS_M = 200; // Max 200 meters

// Background ENTER / EXIT handler
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
  if (error) {
    console.log("Geofence task error:", error);
    return;
  }
  if (!data) return;

  const { eventType, region } = data;
  const type =
    eventType === Location.GeofencingEventType.Enter ? "ENTER" : "EXIT";

  console.log(`[FriendZone] ${type}: ${region.identifier}`);
});

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [geofenceCenter, setGeofenceCenter] = useState(null);
  const [geofencingActive, setGeofencingActive] = useState(false);

  const mapRef = useRef(null);

  useEffect(() => {
    let watchSub;

    (async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      await Location.requestBackgroundPermissionsAsync();

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(current);

      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        (loc) => setLocation(loc)
      );
    })();

    return () => {
      if (watchSub) watchSub.remove();
    };
  }, []);

  const createFriendZone = async () => {
    if (!location) return;

    const center = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    try {
      const already = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (already) await Location.stopGeofencingAsync(GEOFENCE_TASK);

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

      // 🔥 ONLY now make it visible
      setGeofenceCenter(center);
      setGeofencingActive(true);

      // Zoom to zone
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
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You"
          />

          {/* 👇 NOT rendered until button pressed */}
          {geofenceCenter && (
            <Circle
              center={geofenceCenter}
              radius={FRIENDZONE_RADIUS_M}
              strokeWidth={2}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loading}>
          <Text>{errorMsg || "Waiting for location..."}</Text>
        </View>
      )}

      {/* Center FriendZone Button */}
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