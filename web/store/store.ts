import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./slices/counterSlice";
import windowsReducer from "./slices/windowsSlice";
import desktopIconsReducer from "./slices/desktopIconsSlice";
import esgReducer from "./slices/esgSlice";

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    windows: windowsReducer,
    desktopIcons: desktopIconsReducer,
    esg: esgReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
