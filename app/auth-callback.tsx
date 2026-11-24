import { Redirect } from 'expo-router';

/**
 * Email links land here (`lifeos://auth-callback#…`). The root auth listener
 * reads the link and starts the session; this route just hands over to the
 * normal start (sign-in, setup or Today).
 */
export default function AuthCallbackRoute() {
  return <Redirect href="/" />;
}
