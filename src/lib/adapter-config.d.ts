// This file extends the AdapterConfig type from "@types/iobroker"
type Severity = 'info' | 'notify' | 'alert';

interface ConfiguredAdapters {
    /** Try to first let this adapter handle the notification */
    firstAdapter: string;
    /** If first adapter fails, try this one */
    secondAdapter: string;
}

interface CategoryConfiguration extends ConfiguredAdapters {
    /** If category is active */
    active: boolean;
    /** If category should be suppressed */
    suppress: boolean;
    /** If the adapter should delete the notification even if context data is available */
    deleteWithContextData: boolean;
}

type FallbackConfiguration = {
    [key in Severity]: ConfiguredAdapters;
};

interface ConfiguredCategories {
    [scope: string]: {
        [category: string]: CategoryConfiguration;
    };
}

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            categories: ConfiguredCategories;
            fallback: FallbackConfiguration;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
