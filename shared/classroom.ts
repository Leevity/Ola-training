/** Business envelope around the upstream MAIC document. Scenes are validated by the backend DSL boundary. */
export type ClassroomDocument={
 dslVersion:string;
 stage:{id:string;name:string;createdAt:number;updatedAt:number;description?:string};
 scenes:unknown[];
};
export type SceneState={actionIndex:number;answers:Record<string,string[]>;submitted:boolean;notes:Record<string,string>};
