export interface SdpDto {
  Type: RTCSdpType
  Sdp: string
}

export interface IceCandidateDto {
  Candidate: string
  SdpMid?: string | null
  SdpMLineIndex?: number | null
}