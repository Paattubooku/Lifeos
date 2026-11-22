import { Redirect } from 'expo-router';

/** App opens on Today (F03 will route first-run users to onboarding). */
export default function Index() {
  return <Redirect href="/today" />;
}
