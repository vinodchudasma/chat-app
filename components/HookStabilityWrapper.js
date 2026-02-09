'use client';
import { useEffect, useRef } from 'react';

export default function HookStabilityWrapper({ children, name }) {
  const mountCount = useRef(0);
  
  useEffect(() => {
    mountCount.current++;
    console.log(` ${name} mounted (count: ${mountCount.current})`);
    
    return () => {
      console.log(` ${name} unmounted`);
    };
  }, [name]);

  return children;
}