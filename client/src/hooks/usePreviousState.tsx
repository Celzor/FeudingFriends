import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
export default function usePreviousState<T>(initialValue:T):[T,Dispatch<SetStateAction<T>>,T] {
  const [value,setValue]=useState(initialValue);
  const ref=useRef<T>(initialValue);
  useEffect(()=>{ref.current=value;},[value]);
  return [value,setValue,ref.current];
}
