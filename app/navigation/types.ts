import { OperationType, LevelChange } from '../../shared/types';

export type RootStackParamList = {
  ProfileSelect: undefined;
  CreateProfile: undefined;
  Home: undefined;
  Session: { mode: 'quick' | 'operation' | 'daily_goal'; operation: OperationType };
  SessionEnd: {
    sessionId: string;
    userProfileId: string;
    totalPoints: number;
    levelChanges: LevelChange[];
  };
  Parent: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  ReportsTab: undefined;
  RewardsTab: undefined;
  ParentTab: undefined;
};
