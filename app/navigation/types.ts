import { OperationType, LevelChange, SessionMode } from '../../shared/types';

export type RootStackParamList = {
  ProfileSelect: undefined;
  CreateProfile: undefined;
  Home: undefined;
  Session: { mode: SessionMode; operation: OperationType; tableNumber?: number };
  SessionEnd: {
    sessionId: string;
    userProfileId: string;
    totalPoints: number;
    levelChanges: LevelChange[];
  };
  Parent: undefined;
  ScreenTimeRedeem: undefined;
  MultiplicationTable: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  ReportsTab: undefined;
  RewardsTab: undefined;
  ParentTab: undefined;
};
