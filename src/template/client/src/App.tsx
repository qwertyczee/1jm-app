import React, { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState<{message: string} | null>(null);

  useEffect(() => {
    fetch('/api/hello')
      .then(res => res.json() as Promise<{message: string} | null>)
      .then(setData)
      .catch(err => console.error(err));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '50px' }}>
      <h1>Welcome to {{NAME}}</h1>
      <p>Backend says: {data ? data.message : "Loading..."}</p>
      <p><small>Edit client/src/App.tsx to see hot reload!</small></p>
    </div>
  );
}
