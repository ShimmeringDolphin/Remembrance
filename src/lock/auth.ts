// Thin wrapper over expo-local-authentication. The policy (when to lock) lives in core/labs/lock.ts.
import * as LocalAuthentication from 'expo-local-authentication';

/** True when the phone has a screen lock or biometrics set up, so authentication can succeed. */
export async function canUseLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the system prompt (biometrics, with the device passcode as fallback). */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  } catch {
    return false;
  }
}
