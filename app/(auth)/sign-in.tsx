import { SignInScreen } from '@/features/auth/components/SignInScreen';
import { signUpEnabled } from '@/lib/config';

export default function SignInRoute() {
  return <SignInScreen allowSignUp={signUpEnabled} />;
}
