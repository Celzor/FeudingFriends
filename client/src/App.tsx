import React from "react";
import { DataContextProvider } from "./providers/DataProvider";

import Game from "./pages/Game";
import { isRefract, socket } from "./socket";
import { useGameAudioPreload } from "./hooks/useGameSounds";

export default function App() {
  useGameAudioPreload();
  return (
    <DataContextProvider>
      <div className="mainContainer">
        <div className="mainHeader">
          {isRefract && (
            <button
              className="activityLeave"
              onClick={() => "close" in socket && socket.close()}
            >
              Leave activity ↗
            </button>
          )}
          <h1>Feuding Friends</h1>
        </div>

        <div className="mainGameContainer">
          <Game />
        </div>
      </div>
    </DataContextProvider>
  );
}
