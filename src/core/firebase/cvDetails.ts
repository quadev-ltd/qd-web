// The CV's details through Firebase: the owner's document read with Firestore Lite and the
// `updateCvDetails` callable of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/cvDetails.ts.
import { doc, getDoc } from 'firebase/firestore/lite';

import { db } from './app';
import { call, mapped, millis } from './interviewProfile';

import logger from '@/core/logger';
import {
  type CvDetails,
  type CvDetailsField,
  cvDetailsPath,
  CvDetailsSchema,
  UPDATE_CV_DETAILS,
  type UpdateCvDetailsRequest,
  UpdateCvDetailsResponseSchema,
} from '@/core/profile/cvDetails';

/** The details, or `null` while no field is filled (or the document is not understood). */
export const getCvDetails = (uid: string): Promise<CvDetails | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), cvDetailsPath(uid)));
    const data = snapshot.data();
    if (!data) {
      return null;
    }
    const parsed = CvDetailsSchema.safeParse({
      ...data,
      updatedAt: millis(data.updatedAt),
    });
    if (!parsed.success) {
      logger().logError(new Error('getCvDetails: document not understood'));
      return null;
    }
    return parsed.data;
  });

export const updateCvDetails = async (
  request: UpdateCvDetailsRequest,
): Promise<{ changed: CvDetailsField[] }> => {
  const { changed } = await call(
    UPDATE_CV_DETAILS,
    UpdateCvDetailsResponseSchema,
    request,
  );
  return { changed };
};
