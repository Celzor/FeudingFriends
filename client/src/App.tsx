import React, { useEffect, useState } from "react";


import { DataContextProvider } from "./providers/DataProvider";

import Game from "./pages/Game";
import { isRefract, socket } from "./socket";

// the scss only needs to be imported once
// the classes will be available in anything that is rendered from this component
import "./scss/App.scss";

export default function App() {
  return (
    <DataContextProvider>
      <div className="mainContainer">
        <div className="mainHeader">
        {isRefract && <button className="activityLeave" onClick={() => "close" in socket && socket.close()}>Leave activity ↗</button>}
          <h1>Fueding Friends</h1>
        </div>

        <div className="mainGameContainer">
          <Game />
        </div>
      </div>
    </DataContextProvider>
  );
}
