type NewPasswordChallenge = {
  challengeName: 'NEW_PASSWORD_REQUIRED';
  session: string;
  username: string;
};

type AuthReply = {
  idToken?: string;
  challenge?: NewPasswordChallenge;
};

const ID_TOKEN_KEY = 'marketpulse_cognito_id_token';

function cognitoConfig() {
  const region = import.meta.env.VITE_AWS_REGION;
  const clientId = import.meta.env.VITE_AWS_COGNITO_CLIENT_ID;
  if (!region || !clientId) throw new Error('AWS Cognito is not configured for this application');
  return { region, clientId };
}

async function cognitoRequest<T>(target: string, body: Record<string, unknown>): Promise<T> {
  const { region } = cognitoConfig();
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const message = typeof result.message === 'string' ? result.message : 'Cognito sign-in failed';
    throw new Error(message);
  }
  return result as T;
}

function saveIdToken(token: string) {
  sessionStorage.setItem(ID_TOKEN_KEY, token);
}

function authenticationResult(response: { AuthenticationResult?: { IdToken?: string } }): AuthReply {
  const token = response.AuthenticationResult?.IdToken;
  if (!token) throw new Error('Cognito did not return an ID token');
  saveIdToken(token);
  return { idToken: token };
}

export function isAwsCognitoConfigured() {
  return Boolean(import.meta.env.VITE_AWS_REGION && import.meta.env.VITE_AWS_COGNITO_CLIENT_ID);
}

export function getAwsIdToken(): string | null {
  const token = sessionStorage.getItem(ID_TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()) return token;
  } catch {
    // Invalid or expired tokens are removed below.
  }
  sessionStorage.removeItem(ID_TOKEN_KEY);
  return null;
}

export function signOutFromAws() {
  sessionStorage.removeItem(ID_TOKEN_KEY);
}

export async function signInToAws(username: string, password: string): Promise<AuthReply> {
  const { clientId } = cognitoConfig();
  const response = await cognitoRequest<{
    AuthenticationResult?: { IdToken?: string };
    ChallengeName?: string;
    Session?: string;
  }>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED' && response.Session) {
    return { challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: response.Session, username } };
  }
  return authenticationResult(response);
}

export async function completeAwsNewPassword(challenge: NewPasswordChallenge, newPassword: string): Promise<AuthReply> {
  const { clientId } = cognitoConfig();
  const response = await cognitoRequest<{ AuthenticationResult?: { IdToken?: string } }>('RespondToAuthChallenge', {
    ChallengeName: challenge.challengeName,
    ClientId: clientId,
    Session: challenge.session,
    ChallengeResponses: { USERNAME: challenge.username, NEW_PASSWORD: newPassword },
  });
  return authenticationResult(response);
}
