import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 로그인 없이 부를 수 있는 엔드포인트에 붙인다. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
