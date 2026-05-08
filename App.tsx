import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './app/context/AppContext';
import AppNavigator from './app/navigation/AppNavigator';

export default function App() {
  return (
    <AppProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AppProvider>
  );
}
