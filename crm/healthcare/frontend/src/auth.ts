import { Amplify } from 'aws-amplify';
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn, signOut, type SignInOutput } from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
});

export type Step =
  | { kind: 'credentials' }
  | { kind: 'new_password' }
  | { kind: 'totp_setup'; secret: string }
  | { kind: 'totp_code' }
  | { kind: 'done' };

export interface Session {
  idToken: string;
  email: string;
  groups: string[];
}

function toStep(r: SignInOutput): Step {
  if (r.isSignedIn) return { kind: 'done' };
  const next = r.nextStep;
  switch (next.signInStep) {
    case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
      return { kind: 'new_password' };
    case 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP':
      return { kind: 'totp_setup', secret: next.totpSetupDetails.sharedSecret };
    case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
      return { kind: 'totp_code' };
    case 'DONE':
      return { kind: 'done' };
    default:
      throw new Error(`Unsupported sign-in step: ${next.signInStep}`);
  }
}

export const login = async (email: string, password: string) =>
  toStep(await signIn({ username: email, password }));

/** Answers whichever challenge is pending: new password, or a TOTP code. */
export const answer = async (value: string) => toStep(await confirmSignIn({ challengeResponse: value }));

export const logout = () => signOut();

/**
 * The API expects the ID token: Cognito puts custom:tenantId in it, but not in the access token.
 * Role comes from the cognito:groups claim; the server re-checks everything, the UI only hides controls.
 */
export async function currentSession(): Promise<Session | null> {
  try {
    await getCurrentUser();
    const { tokens } = await fetchAuthSession();
    if (!tokens?.idToken) return null;
    const p = tokens.idToken.payload;
    return {
      idToken: tokens.idToken.toString(),
      email: String(p.email ?? ''),
      groups: (p['cognito:groups'] as string[] | undefined) ?? [],
    };
  } catch {
    return null;
  }
}
