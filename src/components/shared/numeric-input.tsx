'use client';

import { useState, useRef } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  inputMode?: 'numeric' | 'decimal';
  allowEmpty?: boolean;
}

export function NumericInput({
  value,
  onChange,
  min = 0,
  placeholder,
  className,
  inputMode = 'numeric',
  allowEmpty = false,
}: NumericInputProps) {
  const [str, setStr] = useState(() => (value === 0 && allowEmpty ? '' : String(value)));
  const focused = useRef(false);

  // Keep in sync when parent changes value externally
  if (!focused.current) {
    const expected = value === 0 && allowEmpty ? '' : String(value);
    if (str !== expected) setStr(expected);
  }

  const handleChange = (raw: string) => {
    // Strip non-numeric chars except one leading minus and one decimal
    const cleaned = inputMode === 'decimal'
      ? raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
      : raw.replace(/[^0-9]/g, '');
    setStr(cleaned);
    const num = parseFloat(cleaned);
    if (cleaned !== '' && !isNaN(num)) {
      onChange(Math.max(min, num));
    }
  };

  const handleBlur = () => {
    focused.current = false;
    const num = parseFloat(str);
    if (str === '' || isNaN(num)) {
      const fallback = allowEmpty ? 0 : min;
      setStr(allowEmpty ? '' : String(fallback));
      onChange(fallback);
    } else {
      const clean = Math.max(min, num);
      setStr(String(clean));
      onChange(clean);
    }
  };

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={str}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      placeholder={placeholder}
      className={className}
    />
  );
}
