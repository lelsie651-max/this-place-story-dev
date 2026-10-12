declare interface MiniProgramCloud {
  init(options: {
    traceUser?: boolean;
  }): void;
}

declare interface MiniProgramAPI {
  cloud?: MiniProgramCloud;
  navigateTo(options: {
    url: string;
  }): void;
}

declare const wx: MiniProgramAPI;

declare function App<T extends Record<string, unknown>>(options: T): void;

declare function Page<T extends Record<string, unknown>>(options: T): void;
