import { useEffect, useState } from 'react';
import { onApiLoading } from '../api';

export default function LoadingBar() {
  const [active, setActive] = useState(false);
  useEffect(() => onApiLoading((isLoading) => setActive(isLoading)), []);
  if (!active) return null;
  return (
    <div className="loading-host">
      <div className="loading-bar" />
    </div>
  );
}
