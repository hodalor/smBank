import { useState } from 'react';

export default function SearchByAccount({ onSearch }) {
  const [value, setValue] = useState('');
  const [type, setType] = useState('account');
  return (
    <div className="row">
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="account">Account Number</option>
        <option value="name">Name</option>
        <option value="nationalId">National ID</option>
      </select>
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={type === 'account' ? 'Enter 10-digit account number' : type === 'name' ? 'Enter client name' : 'Enter national ID'}
        maxLength={type === 'account' ? 10 : 120}
      />
      <button
        className="btn btn-primary"
        onClick={() => onSearch && onSearch({ type, value })}
      >
        Search
      </button>
    </div>
  );
}
