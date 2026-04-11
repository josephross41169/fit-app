// Fitbit API integration helpers

export const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
export const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
export const FITBIT_API_BASE = 'https://api.fitbit.com/1/user/-';

export type FitbitToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export type FitbitSummary = {
  steps: number;
  distance: number;
  floors: number;
  elevation: number;
  caloriesBurned: number;
  calorie: number;
};

export type FitbitActivity = {
  date: string;
  summary: FitbitSummary;
  goals: {
    steps: number;
    distance: number;
    floors: number;
    caloriesBurned: number;
  };
};

export type FitbitHeart = {
  activities: Array<{
    dateTime: string;
    value: {
      customHeartRateZones: any[];
      heartRateZones: any[];
      resting: number;
    };
  }>;
};

export type FitbitSleep = {
  sleep: Array<{
    dateOfSleep: string;
    duration: number; // milliseconds
    efficiency: number;
    startTime: string;
    timeInBed: number;
    minutesAsleep: number;
    minutesAwake: number;
  }>;
};

// Generate Fitbit OAuth URL
export function getFitbitAuthURL(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'activity heart sleep profile',
    redirect_uri: redirectUri,
    state: state,
  });
  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

// Exchange auth code for tokens (called from backend)
export async function exchangeFitbitCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<FitbitToken> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Fitbit token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

// Fetch today's activity summary
export async function getFitbitActivityToday(accessToken: string): Promise<FitbitActivity | null> {
  try {
    const response = await fetch(`${FITBIT_API_BASE}/activities/date/today.json`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Fitbit activity fetch failed:', response.statusText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Fitbit activity error:', error);
    return null;
  }
}

// Fetch today's heart rate data
export async function getFitbitHeartToday(accessToken: string): Promise<FitbitHeart | null> {
  try {
    const response = await fetch(`${FITBIT_API_BASE}/activities/heart/date/today/1d.json`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Fitbit heart fetch failed:', response.statusText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Fitbit heart error:', error);
    return null;
  }
}

// Fetch today's sleep data
export async function getFitbitSleepToday(accessToken: string): Promise<FitbitSleep | null> {
  try {
    const response = await fetch(`${FITBIT_API_BASE}/sleep/date/today.json`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Fitbit sleep fetch failed:', response.statusText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Fitbit sleep error:', error);
    return null;
  }
}
