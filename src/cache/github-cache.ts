export interface GitHubCache {
  getRepositoryExists(repository: string): Promise<boolean | null>;
  setRepositoryExists(repository: string, exists: boolean): Promise<void>;
}
