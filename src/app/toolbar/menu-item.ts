import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface MenuItem {
    label: string;
    icon: IconDefinition;
    link: string;
    showOnMobile: boolean;
    showOnTablet: boolean;
    showOnDesktop: boolean;
}
