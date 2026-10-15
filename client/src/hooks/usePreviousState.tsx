import React, { useMemo, useEffect, useContext, useRef, useState } from "react";

export default function usePreviousState(initialValue: any | null) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  }, [value]); //this code will run when the value of 'value' changes
  //   return ref.current; //in the end, return the current ref value.

  return [value, setValue, ref.current];
}
