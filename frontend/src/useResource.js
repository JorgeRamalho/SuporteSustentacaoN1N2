import { useEffect, useState } from "react";
import { api, isLocalLab } from "./api";

export function useResource(path, tick) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLocalLab()) {
      setData(null);
      setError("");
      return undefined;
    }
    let active = true;
    setError("");
    api(path)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [path, tick]);

  return { data, error };
}
