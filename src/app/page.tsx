"use client";

export default function Home() {
  const handleLogin = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    const spotifyClientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;
    
    console.log('Backend URL:', backendUrl);
    console.log('Spotify Client ID:', spotifyClientId);
    console.log('Redirect URI:', redirectUri);

    if (backendUrl) {
      window.location.href = `${backendUrl}/login`; // Redirect to backend's login route
    } else {
      console.error('Backend URL is not defined');
    }
  };

  return (
    <div className="justify-items-center grid">
      <button
        onClick={handleLogin}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-48"
      >
        Log in with Spotify
      </button>
    </div>
  );
}
