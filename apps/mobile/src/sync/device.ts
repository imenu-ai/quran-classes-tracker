import { AppState } from "react-native";
import * as Network from "expo-network";
import type { TriggerSources } from "./triggers";

const isOnlineState = (state: Network.NetworkState) => state.isConnected !== false;

/** The last connectivity the phone reported; online until it says otherwise. */
let online = true;
const connectivityListeners = new Set<(online: boolean) => void>();

void Network.getNetworkStateAsync()
  .then((state) => {
    online = isOnlineState(state);
  })
  .catch(() => {});

Network.addNetworkStateListener((state) => {
  const next = isOnlineState(state);
  // Only changes: switching from Wi-Fi to cellular isn't "back online".
  if (next === online) return;
  online = next;
  for (const listener of connectivityListeners) listener(next);
});

/** For the engine's `isOnline`: a fetch that's bound to fail isn't tried. */
export const deviceIsOnline = () => online;

/** The app's foreground state and the phone's connectivity, for the sync triggers. */
export const deviceTriggerSources: TriggerSources = {
  isActive: () => AppState.currentState === "active",
  onActive(listener) {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active") listener();
      previous = next;
    });
    return () => subscription.remove();
  },
  onConnectivity(listener) {
    connectivityListeners.add(listener);
    return () => connectivityListeners.delete(listener);
  },
};
