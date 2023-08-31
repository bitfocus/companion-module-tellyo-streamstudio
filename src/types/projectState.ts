interface AudioOutput {
    muted: boolean;
}

export interface ProjectState {
    monitoredAudio: string;
    directEditScene: boolean;
    directEditLayer: boolean;
    currentProgramSceneIndex: number;
    currentPreviewSceneIndex: number;
    currentProgramSceneName: string;
    currentPreviewSceneName: string;
    sceneNames: string[];
    replaysPlaybackSpeed: number;
    replaysSelectedSlot: string | number;
    audioOutputs: Record<string, AudioOutput>;
}
