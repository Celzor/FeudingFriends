import React, { useEffect, useState } from "react";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { DataContextProvider } from "./providers/DataProvider";

import Game from "./pages/Game";

// the scss only needs to be imported once
// the classes will be available in anything that is rendered from this component
import "./scss/App.scss";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Game />,
  },
]);

export default function App() {
  return (
    <DataContextProvider>
      <div className="mainContainer">
        <div className="mainHeader">
          <h1>Fueding Friends</h1>
        </div>

        <div className="mainGameContainer">
          <RouterProvider router={router} />
        </div>
      </div>
    </DataContextProvider>
  );
}
