export interface AdminCacheKeysResponse {
    success: boolean;
    message: string;
    data: {
        total_count: number;
        keys: string[];
        pattern_used: string;
    };
}

export interface AdminCacheDeleteResponse {
    success: boolean;
    message: string;
    data: boolean
}